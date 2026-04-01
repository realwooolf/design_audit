const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

const MATCH_PROMPT = `你是一个 UI 走查工具的图片配对助手。我给你两组图片：
- 第一组是设计稿（Design），编号从 D0 开始
- 第二组是开发截图（Dev），编号从 V0 开始

请根据画面内容（页面布局、文字、功能模块等）判断哪张设计稿对应哪张开发截图。
它们展示的应该是同一个页面/功能的不同版本。

重要：请严格以纯 JSON 格式返回，不要有任何解释文字。
返回格式：{"pairs": [[designIndex, devIndex], ...]}
- designIndex 是设计稿在第一组中的索引（从 0 开始）
- devIndex 是开发截图在第二组中的索引（从 0 开始）
- 每张图片只能出现在一个配对中
- 如果某张图片没有匹配，不要包含它
- 按 confidence 从高到低排列`;

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
    const { designImages, devImages } = req.body;
    if (!designImages?.length || !devImages?.length) {
      return res.status(400).json({ error: '需要提供设计稿和开发截图' });
    }

    // 如果两边都只有 1 张，直接配对
    if (designImages.length === 1 && devImages.length === 1) {
      return res.status(200).json({ pairs: [[0, 0]] });
    }

    // 构建 prompt 描述
    let desc = MATCH_PROMPT + '\n\n';
    desc += `设计稿共 ${designImages.length} 张（D0 ~ D${designImages.length - 1}）\n`;
    desc += `开发截图共 ${devImages.length} 张（V0 ~ V${devImages.length - 1}）\n`;

    const content = [{ type: 'text', text: desc }];

    // 添加设计稿图片
    for (let i = 0; i < designImages.length; i++) {
      content.push({ type: 'text', text: `--- D${i} (设计稿 ${i}) ---` });
      const d = parseB64(designImages[i]);
      content.push({ type: 'image', source: { type: 'base64', media_type: d.media_type, data: d.data } });
    }

    // 添加开发截图
    for (let i = 0; i < devImages.length; i++) {
      content.push({ type: 'text', text: `--- V${i} (开发截图 ${i}) ---` });
      const v = parseB64(devImages[i]);
      content.push({ type: 'image', source: { type: 'base64', media_type: v.media_type, data: v.data } });
    }

    const requestBody = {
      model: MODEL,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content
      }],
      temperature: 0.1
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

    let pairs = [];
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        const parsed = JSON.parse(objMatch[0]);
        pairs = parsed.pairs || [];
      } catch {
        // fallback: 按顺序配对
        const len = Math.min(designImages.length, devImages.length);
        for (let i = 0; i < len; i++) pairs.push([i, i]);
      }
    }

    return res.status(200).json({ pairs });
  } catch (err) {
    console.error('Match pairs error:', err);
    return res.status(500).json({ error: err.message || '配对失败' });
  }
}
