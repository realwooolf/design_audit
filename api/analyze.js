const PRIMARY_MODEL = 'gemini-2.5-pro';
const FALLBACK_MODEL = 'gemini-2.5-flash';

const PROMPT = `你是一个专业的 UI 走查差异检测工具。你的唯一任务是：对比设计稿和开发稿两张图片，找出视觉还原差异。

输入：
- 第一张图：设计稿（Figma 设计规范）
- 第二张图：开发稿（实际开发效果）
- 两张图片上叠加了红色坐标网格，网格标签为 0-1000 坐标系（如 "300,500" 表示 x=300, y=500）。请利用这些网格参考点来精确定位元素
- 可能附带 Figma 精确设计属性 JSON（作为设计规范的权威数据源）

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

数值规则：
1. "expected"（设计稿预期值）：
   - 如果附带了 Figma JSON 数据 → 必须从中提取精确参数值并明确写出，让开发者可以直接对照修改。根据问题类型引用对应字段：
     · 填充色 → fills[].color，如 "填充色: #FF6B35"
     · 描边 → strokes[].color + strokeWeight + strokeAlign，如 "描边: #E0E0E0 1px INSIDE"
     · 透明度 → opacity，如 "opacity: 0.8"
     · 圆角 → cornerRadius 或 borderRadius{tl,tr,bl,br}，如 "圆角: 12px" 或 "圆角: 12/12/0/0px"
     · 阴影/模糊 → effects[]，如 "阴影: blur 4px, offset (0,2)"
     · 字体 → fontFamily，如 "字体: Inter"
     · 字号 → fontSize，如 "字号: 16px"
     · 字重 → fontWeight，如 "字重: 600 (Semi Bold)"
     · 行高 → lineHeight，如 "行高: 24px"
     · 字间距 → letterSpacing，如 "字间距: 0.5px"
     · 文字对齐 → textAlign，如 "对齐: CENTER"
     · 布局方向 → layoutMode，如 "布局: VERTICAL"
     · 元素间距 → itemSpacing，如 "间距: 12px"
     · 内距 → paddingTop/Bottom/Left/Right，如 "padding: 16/20/16/20px"
     · 尺寸 → width/height，如 "宽度: 375px, 高度: 48px"
   - 必须写出具体数值+单位，这是开发者修改的唯一依据
   - 如果没有 Figma 数据 → 用定性描述（如"较粗的字体"、"深色背景"）
2. "actual"（开发稿实际表现）：
   - 永远不要猜测具体数值（禁止猜 hex 色值、猜像素值）
   - 只做定性描述，描述与设计稿的差异方向，如："颜色偏蓝"、"字体明显更细"、"间距偏大约多出一半"、"圆角更小"
3. 绝对禁止：输出"(估算值)"、"(估计)"、"约 #xxx"、"大概 16px"等。不确定就用文字描述。

元素定位（直接影响标注准确性）：
- 图片上的红色网格标签使用 0-1000 坐标系，与 box_2d 坐标一致。请参考网格交叉点标签来确定元素的精确位置
- "figma_node" 字段用于精确定位：从 Figma JSON 数据中找到对应元素，复制其精确的 name 值。优先选叶子节点（TEXT、具体控件），不要选容器（Group/Frame）
- "element" 字段用于人类阅读：用中文语义描述问题所在元素
- 同时提供 box_2d 格式定位：[y_min, x_min, y_max, x_max]，坐标为 0-1000 的归一化整数值
- box_2d 坐标原点在图片左上角，x 轴向右，y 轴向下，必须紧贴元素实际边界
- design_box 和 dev_box 要分别定位设计稿和开发稿中的元素位置（两稿中元素位置可能不同）
- 定位时对照网格标签仔细确认坐标值，不要凭感觉估算

精确标注规则（必须遵守）：
- box_2d 必须精确框选单个问题元素，紧贴该元素边界，不要包含周围无关元素。例如：如果问题是 Now 按钮颜色不对，只框 Now 按钮，不要把相邻的 Later 按钮也框进去
- 在输出 dev_box 前，必须确认开发稿中定位到的元素和设计稿中是同一个元素。通过位置、文本内容、所在区域/父容器来综合判断。如果开发稿中有多个相似元素（如多个加号图标、多个按钮），必须根据上下文（所在页面区域、周围元素、父容器）选择正确的那个
- design_box 和 dev_box 的中心点位置不应有大幅偏差，因为设计稿和开发稿中同一元素的位置通常是接近的。如果你发现 dev_box 中心点和 design_box 中心点差异很大，请重新确认是否定位到了正确的元素
- 坐标示例：屏幕中部一个全宽按钮大约是 [450, 50, 500, 950]；右上角一个小图标大约是 [30, 850, 80, 950]；底部弹层中的按钮大约是 [800, 100, 860, 900]

描述要求：
- "desc" 客观描述差异事实，禁止主观评价（如"缺乏层次感"、"不够精致"）
- 格式：说明设计稿预期是什么（引用 Figma 数据），开发稿实际看起来如何不同

请严格以纯 JSON 格式返回，不要使用 \`\`\`json 代码块，不要有任何解释文字。
返回格式：{"issues": [...]}，最多返回 5 个最明显、最确定的问题。
每个问题字段：
{
  "title": "简短描述（如：标题字重不一致）",
  "element": "问题所在元素的语义描述（如：主操作按钮 Now）",
  "figma_node": "从 Figma JSON 中复制该元素对应节点的精确 name 值（区分大小写，必须能在 JSON 中找到完全一致的 name）。如果没有 Figma 数据则省略此字段",
  "type": "视觉 或 布局 或 内容一致性",
  "priority": "高 或 中 或 低",
  "expected": "设计稿精确值（来自 Figma 数据）或定性描述",
  "actual": "开发稿的定性差异描述（不猜数值）",
  "desc": "客观差异描述",
  "design_box": [y_min, x_min, y_max, x_max],
  "dev_box": [y_min, x_min, y_max, x_max]
}

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

    // 如果有 Figma 设计属性数据，追加到 prompt（JSON 安全截断）
    let propsContext = '';
    if (designProps && Object.keys(designProps).length > 0) {
      let propsJson = JSON.stringify(designProps, null, 2);
      if (propsJson.length > 10000) {
        // 分级精简：先去掉 fills/effects/strokes 的详细数据
        const slim = JSON.parse(JSON.stringify(designProps));
        function simplifyNode(node) {
          if (!node || typeof node !== 'object') return;
          if (Array.isArray(node.fills)) node.fills = node.fills.map(f => f.color || f.type).filter(Boolean);
          if (Array.isArray(node.effects)) node.effects = node.effects.map(e => e.type).filter(Boolean);
          if (Array.isArray(node.strokes)) node.strokes = node.strokes.map(s => s.color || s.type).filter(Boolean);
          if (Array.isArray(node.children)) node.children.forEach(simplifyNode);
        }
        Object.values(slim).forEach(simplifyNode);
        propsJson = JSON.stringify(slim, null, 2);

        // 如果仍超限，砍最深子节点
        if (propsJson.length > 10000) {
          function pruneDeep(node, d) {
            if (!node || typeof node !== 'object') return;
            if (d >= 4 && node.children) { delete node.children; return; }
            if (Array.isArray(node.children)) node.children.forEach(c => pruneDeep(c, d + 1));
          }
          Object.values(slim).forEach(n => pruneDeep(n, 0));
          propsJson = JSON.stringify(slim, null, 2);
        }
      }
      propsContext = `\n\n【Figma 精确设计属性】以下是从 Figma API 读取的权威设计数据。\n重要：\n1. "expected" 字段必须引用其中的精确值\n2. "element" 字段必须使用下方 JSON 中节点的精确 "name" 值（系统据此从 Figma 坐标精确定位标注框）\n${propsJson}`;
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
