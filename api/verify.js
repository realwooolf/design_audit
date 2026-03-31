const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

function parseB64(b64str) {
  const match = b64str.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (match) return { mimeType: match[1], data: match[2] };
  return { mimeType: 'image/jpeg', data: b64str };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { designImage, verifyImage, issueArea, issueTitle } = req.body;
    if (!designImage || !verifyImage) {
      return res.status(400).json({ error: '需要设计稿和核验图' });
    }

    const areaDesc = issueArea
      ? `问题区域：左 ${issueArea.left}，上 ${issueArea.top}，宽 ${issueArea.width}，高 ${issueArea.height}`
      : '问题区域：全图';

    const prompt = `你是一个专业的 UI 走查验收工具。我给你两张图片：
- 第一张是设计稿（原始设计规范）
- 第二张是开发者修改后上传的核验截图

原问题描述：${issueTitle || '未提供'}
${areaDesc}

请判断：在指定区域内，开发者的修改是否已经与设计稿一致？重点检查颜色、间距、字体、圆角、对齐等视觉属性。

重要：请严格以纯 JSON 格式返回。不要使用 \`\`\`json 代码块，不要包含任何 markdown 标记。直接以 { 开头，以 } 结尾。
{
  "pass": true或false,
  "confidence": 0到100的整数,
  "summary": "一句话判断理由",
  "details": "如果未通过，说明哪些地方仍有差异；如果通过则为空字符串"
}`;

    const design = parseB64(designImage);
    const verify = parseB64(verifyImage);

    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: design.mimeType, data: design.data } },
          { inlineData: { mimeType: verify.mimeType, data: verify.data } }
        ]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
    };

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const json = await response.json();
    if (json.error) {
      throw new Error(json.error.message || JSON.stringify(json.error));
    }

    const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let text = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return res.status(200).json({
        pass: !!parsed.pass,
        confidence: parsed.confidence || 0,
        summary: parsed.summary || '',
        details: parsed.details || ''
      });
    }

    throw new Error('AI 返回格式异常');
  } catch (err) {
    console.error('Verify error:', err);
    return res.status(500).json({ error: err.message || '校验失败' });
  }
}
