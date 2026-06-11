import { NextRequest } from 'next/server'
import { prisma, generateInviteCode } from '../_db'
import { requireAuth } from '../_auth'

// POST /api/family/leave
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const member = await prisma.familyMember.findFirst({
      where: { userId },
      orderBy: { joinedAt: 'asc' }
    })
    if (!member) {
      return new Response(JSON.stringify({ error: '您暂无家庭' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    await prisma.familyMember.delete({ where: { id: member.id } })

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true }
    })

    const newFamily = await prisma.family.create({
      data: { name: user?.name ? `${user.name}的家庭` : '我的家庭', inviteCode: generateInviteCode(), createdBy: userId }
    })

    await prisma.familyMember.create({ data: { userId, familyId: newFamily.id } })
    return Response.json({ family: newFamily })
  } catch (error) {
    console.error('离开家庭失败:', error)
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
