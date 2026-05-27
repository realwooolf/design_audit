import sharp from 'sharp';

const PRIMARY_MODEL = 'gemini-2.5-pro';
const FALLBACK_MODEL = 'gemini-2.5-flash';

// 简单内存限流：每 IP 每分钟最多 MAX_REQ 次
const RATE_LIMIT = { windowMs: 60000, maxReq: 5 };
const _rlMap = new Map();
function checkRateLimit(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const hits = (_rlMap.get(ip) || []).filter(t => now - t < RATE_LIMIT.windowMs);
  if (hits.length >= RATE_LIMIT.maxReq) return false;
  hits.push(now);
  _rlMap.set(ip, hits);
  if (_rlMap.size > 500) {
    for (const [k, v] of _rlMap) { if (v.every(t => now - t > RATE_LIMIT.windowMs)) _rlMap.delete(k); }
  }
  return true;
}

// 请求体大小限制 20MB
const MAX_BODY_SIZE = 20 * 1024 * 1024;

// 方案1：颜色归一化，将图片统一转为 sRGB 色域
// 消除 Figma P3 色域与设备 sRGB 之间的天然色差，避免颜色误报
async function normalizeToSRGB(b64data) {
  try {
    const buffer = Buffer.from(b64data, 'base64');
    const normalized = await sharp(buffer).toColorspace('srgb').png().toBuffer();
    return normalized.toString('base64');
  } catch {
    return b64data;
  }
}

const PROMPT = `你是一个专业的 UI 走查差异检测工具。你的唯一任务是：对比设计稿和开发稿两张图片，找出视觉还原差异。

输入：
- 第一张图：设计稿（Figma 设计规范，已归一化为 sRGB 色域）
- 第二张图：开发稿（实际开发效果，已归一化为 sRGB 色域）
- 两张图片上叠加了红色坐标网格，网格标签为 0-1000 坐标系（如 "300,500" 表示 x=300, y=500）
- 可能附带【像素差异图】和【Figma 元素编号清单】

【硬性规则 — 必须严格遵守】
1. 严禁报告任何字重（font-weight）问题。Figma 与真实设备渲染引擎不同，字重视觉差异是天然现象，不属于开发错误，一律不得输出
2. 如果提供了像素差异图：只在差异图红色区域内寻找问题，红色区域以外不报告任何问题
3. 每个问题必须能明确说出"设计稿是X，开发稿是Y"，说不出具体差异就不报

【检测范围】
颜色类：
- 背景色明显偏差（色调、明度、饱和度肉眼可见差异）
- 文字颜色明显偏差
- 图标颜色明显偏差
- 边框颜色明显偏差
- 背景缺失（设计稿有填充色，开发稿没有）

形状与圆角：
- 圆角大小明显不同（直角 vs 圆角，或大圆角 vs 小圆角）
- 元素形状差异（圆形变方形等）

间距与布局：
- 组件之间的间距明显偏差
- 组件内部 padding 明显偏差
- 元素对齐方式不一致

图标与图片：
- 图标图案错误（不同图标）
- 图标背景样式差异（有无背景、背景形状）

内容：
- 文案与设计稿不一致
- 元素缺失或多余

【不报告的情况】
- 字重差异：严禁，无论差异看起来多明显
- 轻微色差：图片压缩、抗锯齿、渲染引擎差异导致的细微色偏
- 字体边缘模糊：不同渲染引擎的正常差异
- 说不清楚的差异：无法明确描述"设计稿是X，开发稿是Y"的不报

【质量要求】
- 宁可漏报，不要误报
- 每个问题必须写出：设计稿里是什么 vs 开发稿里是什么
- 重点关注：间距、圆角、背景缺失——这类问题容易被忽略

数值规则：
1. "expected"（设计稿预期值）：
   - 如果有编号清单 → 直接引用清单中该编号元素的精确属性值
   - 如果没有编号清单 → 用定性描述（如"深蓝色背景"、"大圆角"）
2. "actual"（开发稿实际表现）：
   - 不猜测具体数值，只做定性描述（如"颜色偏灰"、"无圆角"、"间距更小"）
3. 绝对禁止：输出"(估算值)"、"约 #xxx"、"大概 16px"等

元素定位：
- 如果有编号清单：必须在 node_index 字段填写对应编号；同时也必须提供 dev_box 作为坐标备份（防止编号匹配失败时没有坐标可用）
- 如果没有编号清单：提供 design_box 和 dev_box，格式为 [y_min, x_min, y_max, x_max]（0-1000 归一化整数值）
- 匹配编号时，通过元素类型、视觉属性（颜色、字号等）和位置提示词确认正确编号；多个相似元素时用位置区分

描述要求：
- "desc" 客观描述差异事实，禁止主观评价

请严格以纯 JSON 格式返回，不要使用 \`\`\`json 代码块，不要有任何解释文字。
返回格式：{"issues": [...]}，最多返回 10 个问题。
每个问题字段：
{
  "title": "简短描述",
  "element": "问题所在元素的中文语义描述",
  "node_index": 编号清单中对应元素的编号数字（有清单时必填）,
  "type": "视觉 或 布局 或 内容一致性",
  "priority": "高 或 中 或 低",
  "expected": "设计稿精确值或定性描述",
  "actual": "开发稿的定性差异描述",
  "desc": "客观差异描述",
  "design_box": [y_min, x_min, y_max, x_max],
  "dev_box": [y_min, x_min, y_max, x_max]
}

注意：design_box 和 dev_box 无论是否有编号清单，都必须填写。
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

  if (!checkRateLimit(req)) {
    return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  }

  const bodySize = JSON.stringify(req.body).length;
  if (bodySize > MAX_BODY_SIZE) {
    return res.status(413).json({ error: '请求体过大，单次请求不超过 20MB' });
  }

  try {
    const { designImage, devImage, diffImage, designProps } = req.body;
    if (!designImage || !devImage) {
      return res.status(400).json({ error: '需要同时提供设计稿和开发稿图片' });
    }

    const designParsed = parseB64(designImage);
    const devParsed = parseB64(devImage);

    // 方案1：颜色归一化，统一转为 sRGB，消除 Figma P3 色域差异
    const [designNorm, devNorm] = await Promise.all([
      normalizeToSRGB(designParsed.data),
      normalizeToSRGB(devParsed.data),
    ]);

    let propsContext = '';
    if (designProps?.nodeSummary) {
      propsContext = `\n\n【Figma 元素编号清单】以下是设计稿中的元素列表，每个元素有唯一编号。发现问题时请在 node_index 字段返回对应编号。\n${designProps.nodeSummary}`;
    }

    const parts = [
      { text: PROMPT + propsContext },
      { text: '【第一张图：设计稿】' },
      { inlineData: { mimeType: 'image/png', data: designNorm } },
      { text: '【第二张图：开发稿】' },
      { inlineData: { mimeType: 'image/png', data: devNorm } },
    ];

    if (diffImage) {
      const diff = parseB64(diffImage);
      // 方案3：差异热图作为过滤器，AI 只在红色区域内找问题
      parts.push({ text: '【第三张图：像素差异图】红色区域 = 算法检测到的像素差异位置，白色区域 = 两图相同。你只能在红色区域内寻找和报告问题，白色区域不得报告任何问题。' });
      parts.push({ inlineData: { mimeType: diff.mimeType, data: diff.data } });
    }

    const requestBody = {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 16384,
      },
    };

    const apiKey = process.env.GEMINI_API_KEY;

    async function callGemini(model) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 55000);
      let resp;
      try {
        resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          }
        );
      } finally {
        clearTimeout(timer);
      }
      const text = await resp.text();
      let j;
      try { j = JSON.parse(text); } catch { throw new Error(`Gemini 返回非 JSON 响应 (HTTP ${resp.status})`); }
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
