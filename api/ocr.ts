import { requireAuth } from './_auth'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function errorResponse(message: string, status = 400) {
  return json({ error: message }, status)
}

interface OcrItem {
  name: string
  quantity: number
  unit: string
  diseaseCategory: string
  category: string
}

function extractJson(text: string) {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
  return match?.[0] ?? ''
}

function normalizeItems(payload: unknown): OcrItem[] {
  const rawItems = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { items?: unknown[] })?.items)
      ? (payload as { items: unknown[] }).items
      : []

  return rawItems
    .map((item) => {
      const entry = item as Record<string, unknown>
      const name = String(entry.name || '').trim()
      if (!name) return null

      return {
        name,
        quantity: Math.max(1, Number(entry.quantity) || 1),
        unit: String(entry.unit || '盒').trim() || '盒',
        diseaseCategory: String(entry.diseaseCategory || 'other').trim() || 'other',
        category: String(entry.category || 'other').trim() || 'other'
      }
    })
    .filter(Boolean) as OcrItem[]
}

export async function POST(req: Request) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return errorResponse('OCR is not configured. Missing OPENAI_API_KEY.', 500)
  }

  const { imageDataUrl, imageUrl, billText, platform } = await req.json() as {
    imageDataUrl?: string
    imageUrl?: string
    billText?: string
    platform?: string
  }

  const imageRef = typeof imageUrl === 'string' && /^https?:\/\//.test(imageUrl)
    ? imageUrl
    : imageDataUrl

  if (!imageRef || typeof imageRef !== 'string' || (!imageRef.startsWith('data:image/') && !/^https?:\/\//.test(imageRef))) {
    return errorResponse('Please upload a valid image.')
  }

  const prompt = [
    '你是一个药品订单OCR助手。',
    '请从图片中识别药品名称、数量和单位。',
    '如果是电商订单截图，请只提取药品相关商品，忽略运费、优惠、地址、订单号、支付信息。',
    '如果无法确定数量，默认 quantity=1。',
    '请尽量推断 diseaseCategory 和 category；不确定时都填 other。',
    '只返回 JSON，格式为 {"items":[{"name":"", "quantity":1, "unit":"盒", "diseaseCategory":"other", "category":"other"}]}，不要返回 markdown。'
  ].join('\n')

  const extraText = typeof billText === 'string' && billText.trim()
    ? `用户补充文本：\n${billText.trim()}`
    : '用户没有提供补充文本。'

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_OCR_MODEL || 'gpt-5.5',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: `${prompt}\n平台：${platform || 'generic'}\n${extraText}` },
            { type: 'input_image', image_url: imageRef }
          ]
        }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('OpenAI OCR failed:', errorText)
    return errorResponse('OCR service request failed.', 502)
  }

  const data = await response.json() as { output_text?: string }
  const outputText = String(data.output_text || '').trim()
  const jsonText = extractJson(outputText)

  if (!jsonText) {
    return errorResponse('OCR returned no structured result.', 422)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch (error) {
    console.error('Failed to parse OCR JSON:', error)
    return errorResponse('OCR returned invalid JSON.', 422)
  }

  return json({ items: normalizeItems(parsed), rawText: outputText })
}
