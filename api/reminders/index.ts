import { prisma } from '../_db'
import { requireAuth } from '../_auth'

async function getUserFamilyId(userId: string): Promise<string | null> {
  const member = await prisma.familyMember.findFirst({ where: { userId }, orderBy: { joinedAt: 'asc' } })
  return member?.familyId || null
}

// GET /api/reminders
export async function GET(req: Request) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const familyId = await getUserFamilyId(userId)
    if (!familyId) return Response.json({ reminders: [] })

    const reminders = await prisma.reminder.findMany({
      where: { familyId },
      include: { medicine: { select: { name: true, quantity: true, unit: true } } },
      orderBy: { createdAt: 'desc' }
    })
    return Response.json({ reminders })
  } catch (error) {
    console.error('获取提醒错误:', error)
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}