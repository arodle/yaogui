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
  if (!familyId) return json({ reminders: [] })

  const reminders = await prisma.reminder.findMany({
    where: { familyId },
    include: { medicine: { select: { name: true, quantity: true, unit: true } } },
    orderBy: { createdAt: 'desc' }
  })

  return json({ reminders })
}

export async function PUT(req: Request) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return errorResponse('Missing reminder id.')

  const familyId = await getPrimaryFamilyId(auth.userId)
  if (!familyId) {
    return errorResponse('You do not belong to a family.')
  }

  const reminder = await prisma.reminder.findFirst({ where: { id, familyId } })
  if (!reminder) {
    return errorResponse('Reminder not found.', 404)
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

  return json({ reminder: updated })
}

export async function DELETE(req: Request) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return errorResponse('Missing reminder id.')

  const familyId = await getPrimaryFamilyId(auth.userId)
  if (!familyId) {
    return errorResponse('You do not belong to a family.')
  }

  const reminder = await prisma.reminder.findFirst({ where: { id, familyId } })
  if (!reminder) {
    return errorResponse('Reminder not found.', 404)
  }

  await prisma.reminder.delete({ where: { id } })
  return json({ success: true })
}
