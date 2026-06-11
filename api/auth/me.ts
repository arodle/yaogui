import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '../_db'

const JWT_SECRET = process.env.JWT_SECRET || 'medicine-cabinet-secret-key'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: '未提供认证令牌' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    let userId: string
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
      userId = decoded.userId
    } catch {
      return new Response(JSON.stringify({ error: '无效的认证令牌' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true }
    })

    if (!user) {
      return new Response(JSON.stringify({ error: '用户不存在' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    const familyMember = await prisma.familyMember.findFirst({
      where: { userId: user.id },
      orderBy: { joinedAt: 'asc' }
    })

    return Response.json({ user, familyId: familyMember?.familyId })
  } catch {
    return new Response(JSON.stringify({ error: '无效的认证令牌' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }
}
