import { prisma } from '../_db'
import { requireAuth } from '../_auth'

export async function GET(req: Request) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const member = await prisma.familyMember.findFirst({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
      include: { family: true }
    })

    if (!member) {
      return Response.json({ family: null, members: [], medicineCount: 0 })
    }

    const members = await prisma.familyMember.findMany({
      where: { familyId: member.familyId },
      include: { user: { select: { id: true, name: true, email: true } } }
    })

    const medicineCount = await prisma.medicine.count({ where: { familyId: member.familyId } })

    return Response.json({
      family: member.family,
      members: members.map(m => ({
        userId: m.user.id, name: m.user.name, email: m.user.email, joinedAt: m.joinedAt
      })),
      medicineCount
    })
  } catch (error) {
    console.error('获取家庭信息失败:', error)
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
