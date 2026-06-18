import { prisma } from './_db'
import { requireAuth } from './_auth'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function errorResponse(message: string, status = 400) {
  return json({ error: message }, status)
}

async function getPrimaryFamilyId(userId: string) {
  const member = await prisma.familyMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: 'desc' }
  })
  return member?.familyId ?? null
}

export async function GET(req: Request) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth

  const familyId = await getPrimaryFamilyId(auth.userId)
  if (!familyId) return json({ records: [] })

  const searchParams = new URL(req.url).searchParams
  const where: {
    familyId: string
    takenAt?: { gte?: Date; lte?: Date }
  } = { familyId }

  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  if (startDate) where.takenAt = { ...(where.takenAt ?? {}), gte: new Date(startDate) }
  if (endDate) where.takenAt = { ...(where.takenAt ?? {}), lte: new Date(endDate) }

  const records = await prisma.record.findMany({
    where,
    include: { medicine: { select: { name: true, unit: true } } },
    orderBy: { takenAt: 'desc' }
  })

  return json({ records })
}

export async function POST(req: Request) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth

  const familyId = await getPrimaryFamilyId(auth.userId)
  if (!familyId) {
    return errorResponse('You do not belong to a family.')
  }

  const { medicineId, takenAt, status } = await req.json()
  if (!medicineId || !takenAt || !status) {
    return errorResponse('Please provide complete record information.')
  }

  const medicine = await prisma.medicine.findFirst({ where: { id: medicineId, familyId } })
  if (!medicine) {
    return errorResponse('Medicine not found.', 404)
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

  return json({ record })
}
