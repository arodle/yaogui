import { requireAuth } from './_auth'
import { createOssPolicy } from './_oss'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function POST(req: Request) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth

  try {
    const body = await req.json().catch(() => ({}))
    return json(createOssPolicy(auth.userId, body))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create upload policy.'
    return json({ error: message }, 500)
  }
}
