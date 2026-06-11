import { prisma } from '../../_db'
import { requireAuth } from '../../_auth'

export async function DELETE(req: Request, { params }: { params: Record<string, string> }) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth
  const { userId: currentUserId } = auth

  const { userId: targetUserId } = params

  if (currentUserId === targetUserId) {
    return new Response(JSON.stringify({ error: '不能移除自己' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const member = await prisma.familyMember.findFirst({
      where: { userId: currentUserId },
      orderBy: { joinedAt: 'asc' }
    })
    if (!member) {
      return new Response(JSON.stringify({ error: '您暂无家庭' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    await prisma.familyMember.deleteMany({
      where: { userId: targetUserId, familyId: member.familyId }
    })
    return Response.json({ success: true })
  } catch (error) {
    console.error('移除成员失败:', error)
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
