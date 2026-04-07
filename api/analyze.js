const PRIMARY_MODEL = 'gemini-2.5-pro';
const FALLBACK_MODEL = 'gemini-2.5-flash';

const PROMPT = `你是一个专业的 UI 走查差异检测工具。你的唯一任务是：对比设计稿和开发稿两张图片，找出视觉还原差异。

输入：
- 第一张图：设计稿（Figma 设计规范）
- 第二张图：开发稿（实际开发效果）
- 两张图片上叠加了红色坐标网格，网格标签为 0-1000 坐标系（如 "300,500" 表示 x=300, y=500）
- 可能附带【Figma 元素编号清单】：每个设计元素有唯一编号、类型、视觉属性和位置提示

检测范围：
- 颜色差异、间距/边距差异、字体大小/粗细差异、圆角差异
- 透明度差异、布局对齐问题、内容/文字不一致、图标/图片差异

严格质量控制（最重要 — 防止误报）：
- 只报告肉眼可以清晰辨别的明显差异。如果需要"仔细看"或"放大"才能发现，不要报告
- 绝对禁止猜测性差异：如果你不确定是否存在差异，就不要报告
- 字重差异：必须确认视觉上有明显粗细区别才可报告。JPEG 压缩伪影和抗锯齿渲染差异不算字重不一致
- 圆角差异：必须肉眼可见明显不同才报告，1-2px 级别的渲染差异不算
- 颜色差异：必须有明显可辨别的色差才报告，图片压缩造成的轻微色偏不算
- 样式差异：必须是确实不同的样式属性，不要把渲染引擎差异当成样式问题
- 宁可漏报也不要误报：一个误报比漏掉一个小问题更糟糕
- 如果设计稿和开发稿看起来基本一致，返回空列表 {"issues": []} 是完全正确的
- 地图、卫星图、实景照片等动态渲染内容：这些区域内的细节在不同设备/渲染时会自然变化，不属于还原度问题，不要报告
- "新增元素"类问题：必须确认该元素确实只在开发稿中存在、设计稿中完全没有对应元素
- 如果编号清单中某元素的属性与图片视觉一致，即使图片看起来略有差异（渲染/压缩导致），也不要报告

数值规则：
1. "expected"（设计稿预期值）：
   - 如果有编号清单 → 直接引用清单中该编号元素的精确属性值，如 "填充: #FF6B35"、"字号: 16px"、"圆角: 12px"
   - 如果没有编号清单 → 用定性描述（如"较粗的字体"、"深色背景"）
2. "actual"（开发稿实际表现）：
   - 永远不要猜测具体数值（禁止猜 hex 色值、猜像素值）
   - 只做定性描述，如："颜色偏蓝"、"字体明显更细"、"间距偏大"、"圆角更小"
3. 绝对禁止：输出"(估算值)"、"(估计)"、"约 #xxx"、"大概 16px"等。不确定就用文字描述。

元素定位：
- 如果有编号清单：在 node_index 字段填写对应元素的编号数字。系统会自动使用 Figma 精确坐标定位标注框，无需你提供 box_2d
- 如果没有编号清单（纯图片模式）：提供 design_box 和 dev_box，格式为 [y_min, x_min, y_max, x_max]（0-1000 归一化整数值），参考图片上的红色网格标签定位
- 匹配编号时，通过元素的类型、视觉属性（颜色、字号等）和位置提示词来确认正确的编号。如果有多个相似元素，根据位置提示词区分

描述要求：
- "desc" 客观描述差异事实，禁止主观评价（如"缺乏层次感"、"不够精致"）

请严格以纯 JSON 格式返回，不要使用 \`\`\`json 代码块，不要有任何解释文字。
返回格式：{"issues": [...]}，最多返回 5 个最明显、最确定的问题。
每个问题字段：
{
  "title": "简短描述（如：标题字重不一致）",
  "element": "问题所在元素的中文语义描述（如：主操作按钮）",
  "node_index": 编号清单中对应元素的编号数字（如果有清单则必填，没有清单则省略）,
  "type": "视觉 或 布局 或 内容一致性",
  "priority": "高 或 中 或 低",
  "expected": "设计稿精确值（来自编号清单）或定性描述",
  "actual": "开发稿的定性差异描述（不猜数值）",
  "desc": "客观差异描述",
  "design_box": [y_min, x_min, y_max, x_max],
  "dev_box": [y_min, x_min, y_max, x_max]
}

注意：design_box 和 dev_box 在有编号清单时为可选（系统用 node_index 定位），在纯图片模式时为必填。
如果没有发现差异，返回 {"issues": []}。`;

function parseB64(b64str) {
  const match = b64str.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (match) return { mimeType: match[1], data: match[2] };
  return { mimeType: 'image/png', data: b64str };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { designImage, devImage, designProps } = req.body;
    if (!designImage || !devImage) {
      return res.status(400).json({ error: '需要同时提供设计稿和开发稿图片' });
    }

    const design = parseB64(designImage);
    const dev = parseB64(devImage);

    // 如果有 Figma 编号清单，追加到 prompt
    let propsContext = '';
    if (designProps?.nodeSummary) {
      propsContext = `\n\n【Figma 元素编号清单】以下是设计稿中的元素列表，每个元素有唯一编号。发现问题时请在 node_index 字段返回对应编号。\n${designProps.nodeSummary}`;
    }

    const requestBody = {
      contents: [{
        parts: [
          { text: PROMPT + propsContext },
          { inlineData: { mimeType: design.mimeType, data: design.data } },
          { inlineData: { mimeType: dev.mimeType, data: dev.data } }
        ]
      }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 16384
      }
    };

    const apiKey = process.env.GEMINI_API_KEY;

    async function callGemini(model) {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );
      const j = await resp.json();
      if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
      return j;
    }

    let json;
    try {
      json = await callGemini(PRIMARY_MODEL);
    } catch (primaryErr) {
      console.warn(`Primary model (${PRIMARY_MODEL}) failed: ${primaryErr.message}, falling back to ${FALLBACK_MODEL}`);
      json = await callGemini(FALLBACK_MODEL);
    }

    const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let text = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let issues = [];
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        const parsed = JSON.parse(objMatch[0]);
        issues = parsed.issues || [];
      } catch {
        const arrMatch = text.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          try {
            issues = JSON.parse(arrMatch[0]);
          } catch {
            let partial = arrMatch[0];
            const lastComplete = partial.lastIndexOf('}');
            if (lastComplete > 0) {
              partial = partial.substring(0, lastComplete + 1) + ']';
              partial = partial.replace(/,\s*\]$/, ']');
              try { issues = JSON.parse(partial); } catch {}
            }
          }
        }
      }
    }

    return res.status(200).json({ issues });
  } catch (err) {
    console.error('Analysis error:', err);
    const msg = err.message || '分析失败';
    const detail = msg.includes('timeout') || msg.includes('aborted') ? '请求超时，图片可能过大'
      : msg.includes('API_KEY') || msg.includes('401') || msg.includes('403') ? 'API Key 无效或过期'
      : msg.includes('429') ? 'API 调用频率超限，请稍后重试'
      : msg;
    return res.status(500).json({ error: detail });
  }
}
