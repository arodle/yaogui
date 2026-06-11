import { prisma } from '../../_db'
import { requireAuth } from '../../_auth'

async function getUserFamilyId(userId: string): Promise<string | null> {
  const member = await prisma.familyMember.findFirst({ where: { userId }, orderBy: { joinedAt: 'asc' } })
  return member?.familyId || null
}

// PUT /api/medicines/[id]
export async function PUT(req: Request, { params }: { params: Record<string, string> }) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth
  const { userId } = auth
  const { id } = params

  try {
    const familyId = await getUserFamilyId(userId)
    if (!familyId) {
      return new Response(JSON.stringify({ error: '您暂无家庭' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const medicine = await prisma.medicine.findFirst({ where: { id, familyId } })
    if (!medicine) {
      return new Response(JSON.stringify({ error: '药品不存在' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const { name, category, diseaseCategory, photo, quantity, unit, expiryDate, threshold, reminderTimes } = body

    const updated = await prisma.medicine.update({
      where: { id },
      data: {
        name: name ?? medicine.name,
        category: category ?? medicine.category,
        diseaseCategory: diseaseCategory ?? medicine.diseaseCategory,
        photo: photo !== undefined ? photo : medicine.photo,
        quantity: quantity ?? medicine.quantity,
        unit: unit ?? medicine.unit,
        expiryDate: expiryDate ? new Date(expiryDate) : medicine.expiryDate,
        threshold: threshold ?? medicine.threshold
      }
    })

    if (reminderTimes) {
      await prisma.reminder.updateMany({ where: { medicineId: id }, data: { times: reminderTimes } })
    }

    return Response.json({ medicine: updated })
  } catch (error) {
    console.error('更新药品错误:', error)
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

// DELETE /api/medicines/[id]
export async function DELETE(req: Request, { params }: { params: Record<string, string> }) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth
  const { userId } = auth
  const { id } = params

  try {
    const familyId = await getUserFamilyId(userId)
    if (!familyId) {
      return new Response(JSON.stringify({ error: '您暂无家庭' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const medicine = await prisma.medicine.findFirst({ where: { id, familyId } })
    if (!medicine) {
      return new Response(JSON.stringify({ error: '药品不存在' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    await prisma.medicine.delete({ where: { id } })
    return Response.json({ success: true })
  } catch (error) {
    console.error('删除药品错误:', error)
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}