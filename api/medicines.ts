import { prisma } from './_db'
import { requireAuth } from './_auth'
import { createSignedOssReadUrl, normalizeOssStorageUrl } from './_oss'

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
  if (!familyId) return json({ medicines: [] })

  const action = new URL(req.url).searchParams.get('action')
  if (action === 'categories') {
    const medicines = await prisma.medicine.findMany({
      where: { familyId },
      select: { category: true }
    })
    const categories = Array.from(new Set(medicines.map((medicine) => medicine.category).filter(Boolean)))
    return json({ categories })
  }

  const medicines = await prisma.medicine.findMany({
    where: { familyId },
    orderBy: { createdAt: 'desc' }
  })

  return json({
    medicines: medicines.map((medicine) => ({
      ...medicine,
      photo: medicine.photo ? createSignedOssReadUrl(medicine.photo) : null
    }))
  })
}

export async function POST(req: Request) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth

  const familyId = await getPrimaryFamilyId(auth.userId)
  if (!familyId) {
    return errorResponse('You do not belong to a family.')
  }

  const body = await req.json()
  const { name, category, diseaseCategory, photo, quantity, unit, expiryDate, threshold, reminderTimes } = body

  if (!name || !category || quantity === undefined || !unit) {
    return errorResponse('Please provide complete medicine information.')
  }

  const medicine = await prisma.medicine.create({
    data: {
      familyId,
      name,
      category,
      diseaseCategory: diseaseCategory || 'other',
      photo: normalizeOssStorageUrl(photo),
      quantity,
      unit,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      threshold: threshold || 10
    }
  })

  if (Array.isArray(reminderTimes) && reminderTimes.length > 0) {
    await prisma.reminder.create({
      data: { familyId, medicineId: medicine.id, times: reminderTimes }
    })
  }

  return json({
    medicine: {
      ...medicine,
      photo: medicine.photo ? createSignedOssReadUrl(medicine.photo) : null
    }
  })
}

export async function PUT(req: Request) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const action = url.searchParams.get('action')

  const familyId = await getPrimaryFamilyId(auth.userId)
  if (!familyId) {
    return errorResponse('You do not belong to a family.')
  }

  if (action === 'rename-category') {
    const { fromCategory, toCategory } = await req.json()
    if (!fromCategory || !toCategory) {
      return errorResponse('Please provide source and target category names.')
    }

    await prisma.medicine.updateMany({
      where: { familyId, category: fromCategory },
      data: { category: toCategory }
    })

    return json({ success: true })
  }

  if (!id) return errorResponse('Missing medicine id.')

  const medicine = await prisma.medicine.findFirst({ where: { id, familyId } })
  if (!medicine) {
    return errorResponse('Medicine not found.', 404)
  }

  const body = await req.json()
  const { name, category, diseaseCategory, photo, quantity, unit, expiryDate, threshold, reminderTimes } = body

  const updated = await prisma.medicine.update({
    where: { id },
    data: {
      name: name ?? medicine.name,
      category: category ?? medicine.category,
      diseaseCategory: diseaseCategory ?? medicine.diseaseCategory,
      photo: photo !== undefined ? normalizeOssStorageUrl(photo) : medicine.photo,
      quantity: quantity ?? medicine.quantity,
      unit: unit ?? medicine.unit,
      expiryDate: expiryDate ? new Date(expiryDate) : medicine.expiryDate,
      threshold: threshold ?? medicine.threshold
    }
  })

  if (Array.isArray(reminderTimes)) {
    if (reminderTimes.length === 0) {
      await prisma.reminder.deleteMany({
        where: { medicineId: id, familyId }
      })
    } else {
      const existingReminder = await prisma.reminder.findFirst({
        where: { medicineId: id, familyId }
      })

      if (existingReminder) {
        await prisma.reminder.update({
          where: { id: existingReminder.id },
          data: { times: reminderTimes, enabled: true }
        })
      } else {
        await prisma.reminder.create({
          data: { familyId, medicineId: id, times: reminderTimes, enabled: true }
        })
      }
    }
  }

  return json({
    medicine: {
      ...updated,
      photo: updated.photo ? createSignedOssReadUrl(updated.photo) : null
    }
  })
}

export async function DELETE(req: Request) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  const familyId = await getPrimaryFamilyId(auth.userId)
  if (!familyId) {
    return errorResponse('You do not belong to a family.')
  }

  if (action === 'delete-category') {
    const category = url.searchParams.get('category')
    if (!category) return errorResponse('Missing category name.')

    await prisma.medicine.updateMany({
      where: { familyId, category },
      data: { category: 'other' }
    })

    return json({ success: true })
  }

  const id = url.searchParams.get('id')
  if (!id) return errorResponse('Missing medicine id.')

  const medicine = await prisma.medicine.findFirst({ where: { id, familyId } })
  if (!medicine) {
    return errorResponse('Medicine not found.', 404)
  }

  await prisma.reminder.deleteMany({ where: { medicineId: id, familyId } })
  await prisma.medicine.delete({ where: { id } })
  return json({ success: true })
}
