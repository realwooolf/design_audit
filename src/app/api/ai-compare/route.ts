import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import sharp from 'sharp'
import pixelmatch from 'pixelmatch'

const dimensionPrompts: Record<string, string> = {
  visual: '视觉还原（颜色、字体大小、行高、内外边距、组件尺寸）',
  interaction: '交互行为（按钮状态、点击区域大小）',
  content: '内容文案（文字内容、图标是否一致）',
  layout: '响应式布局（元素对齐、页面结构）',
  i18n: '多语言适配（文字溢出、截断）',
  accessibility_font: '适老化大字体（字号是否足够大）',
  dark_mode: '深色/浅色模式（颜色是否切换正确）',
  accessibility: '无障碍（对比度、可操作性）',
}

function clampAnnotation(a: { x?: number; y?: number; width?: number; height?: number } | undefined) {
  if (!a || typeof a.x !== 'number' || typeof a.y !== 'number' || typeof a.width !== 'number' || typeof a.height !== 'number') {
    return null
  }
  const x = Math.max(0, Math.min(100, a.x))
  const y = Math.max(0, Math.min(100, a.y))
  const width = Math.max(1, Math.min(100 - x, a.width))
  const height = Math.max(1, Math.min(100 - y, a.height))
  return { x, y, width, height }
}

async function preprocessImages(designUrl: string, implUrl: string) {
  const [designRes, implRes] = await Promise.all([
    fetch(designUrl),
    fetch(implUrl),
  ])
  const [designRaw, implRaw] = await Promise.all([
    designRes.arrayBuffer().then(b => Buffer.from(b)),
    implRes.arrayBuffer().then(b => Buffer.from(b)),
  ])

  // 方案1：颜色归一化，统一转为 sRGB
  const designNorm = await sharp(designRaw).toColorspace('srgb').png().toBuffer()
  const { width, height } = await sharp(designNorm).metadata()
  const w = width!
  const h = height!

  // 开发稿缩放到与设计稿相同尺寸，统一色域
  const implNorm = await sharp(implRaw)
    .resize(w, h, { fit: 'fill' })
    .toColorspace('srgb')
    .png()
    .toBuffer()

  // 方案3：像素差异计算
  const designPixels = await sharp(designNorm).raw().ensureAlpha().toBuffer()
  const implPixels = await sharp(implNorm).raw().ensureAlpha().toBuffer()
  const diffPixels = Buffer.alloc(w * h * 4)

  const numDiff = pixelmatch(
    new Uint8Array(designPixels),
    new Uint8Array(implPixels),
    new Uint8Array(diffPixels.buffer),
    w,
    h,
    { threshold: 0.1, alpha: 0.1, diffColor: [255, 50, 50] }
  )

  // 生成差异热图 PNG
  const diffPng = await sharp(diffPixels, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer()

  const diffRatio = numDiff / (w * h)

  return {
    designBase64: designNorm.toString('base64'),
    implBase64: implNorm.toString('base64'),
    diffBase64: diffPng.toString('base64'),
    diffRatio,
  }
}

export async function POST(request: NextRequest) {
  const { taskId, versionId, dimensions } = await request.json()

  const supabase = await createClient()

  const { data: version } = await supabase
    .from('task_versions')
    .select('*')
    .eq('id', versionId)
    .single()

  if (!version || !version.design_image_url || !version.impl_image_url) {
    return NextResponse.json({ error: '缺少图片' }, { status: 400 })
  }

  await supabase.from('task_versions').update({ ai_status: 'processing' }).eq('id', versionId)
  await supabase.from('tasks').update({ status: 'ai_comparing' }).eq('id', taskId)
  await supabase.from('timeline_events').insert({
    task_id: taskId,
    event_type: 'ai_started',
    payload: { version_id: versionId },
  })

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // 图片预处理：颜色归一化 + 像素差异热图
    const { designBase64, implBase64, diffBase64, diffRatio } = await preprocessImages(
      version.design_image_url,
      version.impl_image_url
    )

    const dimensionList = (dimensions as string[])
      .map(d => `- ${dimensionPrompts[d] ?? d}`)
      .join('\n')

    const diffPercent = (diffRatio * 100).toFixed(1)

    const prompt = `请对比以下三张图片：
第一张：设计稿（设计师期望效果，已统一为 sRGB 色域）
第二张：还原稿（开发实现效果，已统一为 sRGB 色域）
第三张：差异热图（红色区域 = 像素差异位置，共 ${diffPercent}% 像素存在差异）

重要规则：
- 只在第三张热图的红色区域内寻找问题，热图无红色的地方不要报
- 第一张始终是设计稿，第二张始终是还原稿，请勿混淆

请重点检查以下维度：
${dimensionList}

【不要报告的情况】
- 字重差异：严禁报告，Figma 与设备渲染天然不同
- 轻微色差：热图虽有轻微红色但肉眼几乎看不出差异的，不报
- 抗锯齿、字体边缘模糊：正常渲染差异，不报
- 说不清"设计稿是X，还原稿是Y"的：不报

【必须报告的情况（仅限热图红色区域）】
- 颜色明显偏差：色调、明度、饱和度肉眼可见差异
- 背景缺失：设计稿有背景色/填充，还原稿没有
- 间距明显偏差：组件间距与设计稿差距明显
- 圆角差异：圆角大小明显不同
- 图标图案错误：图标与设计稿不同
- 内容文案不符：文字内容不一致
- 元素缺失或多余

【质量要求】
- 每个问题必须写出：设计稿里是什么 vs 还原稿里是什么
- 宁可漏报，不要误报

【标注坐标规则】
annotation 坐标是问题元素在【还原稿】中的位置（百分比，左上角原点）：
- 精确贴合单个元素边界
- 所有值在 0-100 范围内，且 x+width ≤ 100，y+height ≤ 100

输出 JSON，只输出 JSON，不要额外文字。如果没有问题，issues 数组为空。

格式：
{
  "issues": [
    {
      "title": "问题标题",
      "description": "设计稿中...，还原稿中...",
      "dimension": "visual",
      "priority": "high|medium|low",
      "diff_type": "color|spacing|border_radius|icon|content|missing_element",
      "diff_expected": "设计稿的值或描述",
      "diff_actual": "还原稿的值或描述",
      "annotation": { "x": 0, "y": 0, "width": 10, "height": 5 }
    }
  ],
  "summary": "整体描述"
}`

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 8000,
      thinking: { type: 'enabled', budget_tokens: 3000 },
      system: '你是一位有十年经验的 UI 设计走查专家。硬性规则：①严禁报告任何字重问题；②只报告差异热图红色区域内的问题；③每个问题必须能明确说出设计稿是什么、还原稿是什么；④宁可漏报，不要误报。',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: designBase64 } },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: implBase64 } },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: diffBase64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    })

    const content = response.content.find(b => b.type === 'text')
    if (!content || content.type !== 'text') throw new Error('非文本响应')

    const jsonText = content.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    let aiResult: { issues?: unknown[]; summary?: string }
    try {
      aiResult = JSON.parse(jsonText)
    } catch {
      console.error('AI 返回的 JSON 解析失败:', jsonText.slice(0, 500))
      aiResult = { issues: [], summary: 'AI 返回格式异常，未能解析结果' }
    }
    if (!Array.isArray(aiResult.issues)) {
      aiResult.issues = []
    }

    await supabase.from('task_versions').update({
      ai_result: aiResult,
      ai_status: 'done',
      ai_completed_at: new Date().toISOString(),
    }).eq('id', versionId)

    if (aiResult.issues && aiResult.issues.length > 0) {
      const issueInserts = (aiResult.issues as {
        title: string; description: string; dimension: string; priority: string;
        diff_type?: string; diff_expected?: string; diff_actual?: string;
        annotation?: { x: number; y: number; width: number; height: number }
      }[]).map((issue) => {
        const clamped = clampAnnotation(issue.annotation)
        return {
          task_id: taskId,
          version_id: versionId,
          title: issue.title,
          description: issue.description,
          dimension: issue.dimension,
          priority: issue.priority,
          status: 'pending',
          source: 'ai',
          diff_type: issue.diff_type ?? null,
          diff_expected: issue.diff_expected ?? null,
          diff_actual: issue.diff_actual ?? null,
          annotation_x: clamped?.x ?? null,
          annotation_y: clamped?.y ?? null,
          annotation_width: clamped?.width ?? null,
          annotation_height: clamped?.height ?? null,
        }
      })

      await supabase.from('issues').insert(issueInserts)
    }

    await supabase.from('tasks').update({ status: 'dev_reviewing' }).eq('id', taskId)
    await supabase.from('timeline_events').insert({
      task_id: taskId,
      event_type: 'ai_completed',
      payload: { issue_count: aiResult.issues?.length ?? 0, summary: aiResult.summary },
    })

    return NextResponse.json({ success: true, issueCount: aiResult.issues?.length ?? 0 })
  } catch (error) {
    console.error('AI 比对失败', error)
    await supabase.from('task_versions').update({ ai_status: 'failed' }).eq('id', versionId)
    return NextResponse.json({ error: 'AI 比对失败' }, { status: 500 })
  }
}
