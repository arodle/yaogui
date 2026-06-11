import type { Request } from 'undici'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'medicine-cabinet-secret-key'

export interface AuthUser {
  userId: string
}

export function getUserIdFromRequest(req: Request): string | null {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser
    return decoded.userId
  } catch {
    return null
  }
}

export function requireAuth(req: Request): { userId: string } | Response {
  const userId = getUserIdFromRequest(req)
  if (!userId) {
    return new Response(JSON.stringify({ error: '未授权' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }
  return { userId }
}

export function makeToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' })
}
