import { prisma } from '../_db'
import { requireAuth } from '../_auth'

async function getUserFamilyId(userId: string): Promise<string | null> {
  const member = await prisma.familyMember.findFirst({ where: { userId }, orderBy: { joinedAt: 'asc' } })
  return member?.familyId || null
}

// GET /api/records
export async function GET(req: Request) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const familyId = await getUserFamilyId(userId)
    if (!familyId) return Response.json({ records: [] })

    const { searchParams } = new URL(req.url)
    const where: any = { familyId }

    if (searchParams.get('startDate')) {
      where.takenAt = { ...where.takenAt, gte: new Date(searchParams.get('startDate')!) }
    }
    if (searchParams.get('endDate')) {
      where.takenAt = { ...where.takenAt, lte: new Date(searchParams.get('endDate')!) }
    }

    const records = await prisma.record.findMany({
      where,
      include: { medicine: { select: { name: true, unit: true } } },
      orderBy: { takenAt: 'desc' }
    })
    return Response.json({ records })
  } catch (error) {
    console.error('获取服药记录错误:', error)
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

// POST /api/records
export async function POST(req: Request) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const familyId = await getUserFamilyId(userId)
    if (!familyId) {
      return new Response(JSON.stringify({ error: '您暂无家庭' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const { medicineId, takenAt, status } = await req.json()
    if (!medicineId || !takenAt || !status) {
      return new Response(JSON.stringify({ error: '请提供完整的服药记录信息' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const medicine = await prisma.medicine.findFirst({ where: { id: medicineId, familyId } })
    if (!medicine) {
      return new Response(JSON.stringify({ error: '药品不存在' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    const record = await prisma.record.create({
      data: { familyId, medicineId, takenAt: new Date(takenAt), status }
    })

    if (status === 'taken') {
      await prisma.medicine.update({
        where: { id: medicineId },
        data: { quantity: { decrement: 1 } }
      })
    }

    return Response.json({ record })
  } catch (error) {
    console.error('创建服药记录错误:', error)
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}