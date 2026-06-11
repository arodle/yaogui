import { NextRequest } from 'next/server'
import { prisma } from '../_db'
import { requireAuth } from '../_auth'

// GET /api/family/members
export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const member = await prisma.familyMember.findFirst({
      where: { userId },
      orderBy: { joinedAt: 'asc' }
    })

    if (!member) return Response.json({ members: [] })

    const members = await prisma.familyMember.findMany({
      where: { familyId: member.familyId },
      include: { user: { select: { id: true, name: true, email: true } } }
    })

    return Response.json({
      members: members.map(m => ({
        userId: m.user.id, name: m.user.name, email: m.user.email, joinedAt: m.joinedAt
      }))
    })
  } catch (error) {
    console.error('获取家庭成员失败:', error)
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
