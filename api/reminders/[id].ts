import { NextRequest } from 'next/server'
import { prisma } from '../../_db'
import { requireAuth } from '../../_auth'

async function getUserFamilyId(userId: string): Promise<string | null> {
  const member = await prisma.familyMember.findFirst({ where: { userId }, orderBy: { joinedAt: 'asc' } })
  return member?.familyId || null
}

// PUT /api/reminders/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth
  const { userId } = auth
  const { id } = await params

  try {
    const familyId = await getUserFamilyId(userId)
    if (!familyId) {
      return new Response(JSON.stringify({ error: '您暂无家庭' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const reminder = await prisma.reminder.findFirst({ where: { id, familyId } })
    if (!reminder) {
      return new Response(JSON.stringify({ error: '提醒不存在' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const { enabled, times } = body

    const updated = await prisma.reminder.update({
      where: { id },
      data: {
        enabled: enabled ?? reminder.enabled,
        times: times ?? reminder.times
      }
    })
    return Response.json({ reminder: updated })
  } catch (error) {
    console.error('更新提醒错误:', error)
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

// DELETE /api/reminders/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth
  const { userId } = auth
  const { id } = await params

  try {
    const familyId = await getUserFamilyId(userId)
    if (!familyId) {
      return new Response(JSON.stringify({ error: '您暂无家庭' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const reminder = await prisma.reminder.findFirst({ where: { id, familyId } })
    if (!reminder) {
      return new Response(JSON.stringify({ error: '提醒不存在' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    await prisma.reminder.delete({ where: { id } })
    return Response.json({ success: true })
  } catch (error) {
    console.error('删除提醒错误:', error)
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
