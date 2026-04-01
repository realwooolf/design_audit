const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

const PROMPT = `你是一个专业的 UI 走查工具。我给你两张图片：
- 第一张是设计稿（Figma 预期效果）
- 第二张是开发稿（实际开发还原效果）

请仔细对比两张图片，找出所有还原差异，包括但不限于：
- 颜色差异（色值偏差）
- 间距/边距差异（像素偏差）
- 字体大小/粗细差异
- 圆角差异
- 布局对齐问题
- 内容/文字不一致
- 图标/图片差异

重要：请严格以纯 JSON 格式返回。不要使用 \`\`\`json 代码块，不要包含任何 markdown 标记，不要有任何解释文字。
返回格式：{"issues": [...]}，最多返回 8 个最重要的问题。
每个问题包含以下字段：
{
  "title": "问题简短描述",
  "type": "视觉 或 布局 或 内容一致性",
  "priority": "高 或 中 或 低",
  "expected": "Figma 预期值（尽量给出具体数值如 #FF6B35、16px、8px 圆角等）",
  "actual": "开发实际值（尽量给出具体数值）",
  "desc": "详细描述这个差异",
  "area": {
    "left": "问题区域左边距百分比，如 10%",
    "top": "问题区域顶部百分比，如 20%",
    "width": "问题区域宽度百分比，如 30%",
    "height": "问题区域高度百分比，如 15%"
  }
}

area 字段用百分比表示问题在图片中的大致位置和范围。
如果没有发现差异，返回 {"issues": []}。`;

function parseB64(b64str) {
  const match = b64str.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (match) return { media_type: match[1], data: match[2] };
  return { media_type: 'image/jpeg', data: b64str };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { designImage, devImage } = req.body;
    if (!designImage || !devImage) {
      return res.status(400).json({ error: '需要同时提供设计稿和开发稿图片' });
    }

    const design = parseB64(designImage);
    const dev = parseB64(devImage);

    const requestBody = {
      model: MODEL,
      max_tokens: 16384,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          { type: 'image', source: { type: 'base64', media_type: design.media_type, data: design.data } },
          { type: 'image', source: { type: 'base64', media_type: dev.media_type, data: dev.data } }
        ]
      }],
      temperature: 0.2
    };

    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    const json = await response.json();
    if (json.error) {
      throw new Error(json.error.message || JSON.stringify(json.error));
    }

    const rawText = json.content?.[0]?.text || '{}';
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
      : msg.includes('api_key') || msg.includes('401') ? 'API Key 无效或过期'
      : msg.includes('429') ? 'API 调用频率超限，请稍后重试'
      : msg;
    return res.status(500).json({ error: detail });
  }
}
