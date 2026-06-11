import { prisma, generateInviteCode } from '../_db'
import { requireAuth } from '../_auth'

export async function POST(req: Request) {
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

    const family = await prisma.family.update({
      where: { id: member.familyId },
      data: { inviteCode: generateInviteCode() }
    })
    return Response.json({ family })
  } catch (error) {
    console.error('重新生成邀请码失败:', error)
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
