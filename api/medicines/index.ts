import { prisma } from '../_db'
import { requireAuth } from '../_auth'

async function getUserFamilyId(userId: string): Promise<string | null> {
  const member = await prisma.familyMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: 'asc' }
  })
  return member?.familyId || null
}

// GET /api/medicines
export async function GET(req: Request) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const familyId = await getUserFamilyId(userId)
    if (!familyId) return Response.json({ medicines: [] })

    const medicines = await prisma.medicine.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' }
    })
    return Response.json({ medicines })
  } catch (error) {
    console.error('获取药品列表错误:', error)
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

// POST /api/medicines
export async function POST(req: Request) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const familyId = await getUserFamilyId(userId)
    if (!familyId) {
      return new Response(JSON.stringify({ error: '您暂无家庭' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const { name, category, diseaseCategory, photo, quantity, unit, expiryDate, threshold, reminderTimes } = body

    if (!name || !category || quantity === undefined || !unit) {
      return new Response(JSON.stringify({ error: '请提供完整的药品信息' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const medicine = await prisma.medicine.create({
      data: {
        familyId, name, category,
        diseaseCategory: diseaseCategory || 'other',
        photo: photo || null,
        quantity,
        unit,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        threshold: threshold || 10
      }
    })

    if (reminderTimes && reminderTimes.length > 0) {
      await prisma.reminder.create({
        data: { familyId, medicineId: medicine.id, times: reminderTimes }
      })
    }

    return Response.json({ medicine })
  } catch (error) {
    console.error('添加药品错误:', error)
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}