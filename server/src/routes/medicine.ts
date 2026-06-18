import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthRequest } from '../middleware/auth.js'
import { createSignedOssReadUrl, normalizeOssStorageUrl } from '../lib/oss.js'

const router = Router()
const prisma = new PrismaClient()

async function getUserFamilyId(userId: string): Promise<string | null> {
  const member = await prisma.familyMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: 'desc' }
  })
  return member?.familyId || null
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const familyId = await getUserFamilyId(userId)

    if (!familyId) {
      return res.json({ medicines: [] })
    }

    if (req.query.action === 'categories') {
      const medicines = await prisma.medicine.findMany({
        where: { familyId },
        select: { category: true }
      })
      const categories = Array.from(new Set(medicines.map((medicine) => medicine.category).filter(Boolean)))
      return res.json({ categories })
    }

    const medicines = await prisma.medicine.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' }
    })

    return res.json({
      medicines: medicines.map((medicine) => ({
        ...medicine,
        photo: medicine.photo ? createSignedOssReadUrl(medicine.photo) : null
      }))
    })
  } catch (error) {
    console.error('Get medicines failed:', error)
    return res.status(500).json({ error: 'Server error.' })
  }
})

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const familyId = await getUserFamilyId(userId)

    if (!familyId) {
      return res.status(400).json({ error: 'You do not belong to a family.' })
    }

    const { name, category, diseaseCategory, photo, quantity, unit, expiryDate, threshold, reminderTimes } = req.body
    if (!name || !category || quantity === undefined || !unit) {
      return res.status(400).json({ error: 'Please provide complete medicine information.' })
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
        data: {
          familyId,
          medicineId: medicine.id,
          times: reminderTimes
        }
      })
    }

    return res.json({
      medicine: {
        ...medicine,
        photo: medicine.photo ? createSignedOssReadUrl(medicine.photo) : null
      }
    })
  } catch (error) {
    console.error('Create medicine failed:', error)
    return res.status(500).json({ error: 'Server error.' })
  }
})

router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const familyId = await getUserFamilyId(userId)
    if (!familyId) {
      return res.status(400).json({ error: 'You do not belong to a family.' })
    }

    if (req.query.action === 'rename-category') {
      const { fromCategory, toCategory } = req.body
      if (!fromCategory || !toCategory) {
        return res.status(400).json({ error: 'Please provide source and target category names.' })
      }

      await prisma.medicine.updateMany({
        where: { familyId, category: fromCategory },
        data: { category: toCategory }
      })

      return res.json({ success: true })
    }

    return res.status(404).json({ error: 'Route not found.' })
  } catch (error) {
    console.error('Rename category failed:', error)
    return res.status(500).json({ error: 'Server error.' })
  }
})

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const familyId = await getUserFamilyId(userId)
    const { id } = req.params
    const { name, category, diseaseCategory, photo, quantity, unit, expiryDate, threshold, reminderTimes } = req.body

    if (!familyId) {
      return res.status(400).json({ error: 'You do not belong to a family.' })
    }

    const medicine = await prisma.medicine.findFirst({ where: { id, familyId } })
    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found.' })
    }

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
            data: {
              familyId,
              medicineId: id,
              times: reminderTimes,
              enabled: true
            }
          })
        }
      }
    }

    return res.json({
      medicine: {
        ...updated,
        photo: updated.photo ? createSignedOssReadUrl(updated.photo) : null
      }
    })
  } catch (error) {
    console.error('Update medicine failed:', error)
    return res.status(500).json({ error: 'Server error.' })
  }
})

router.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const familyId = await getUserFamilyId(userId)
    if (!familyId) {
      return res.status(400).json({ error: 'You do not belong to a family.' })
    }

    if (req.query.action === 'delete-category') {
      const category = String(req.query.category || '')
      if (!category) {
        return res.status(400).json({ error: 'Please provide a category name.' })
      }

      await prisma.medicine.updateMany({
        where: { familyId, category },
        data: { category: 'other' }
      })

      return res.json({ success: true })
    }

    return res.status(404).json({ error: 'Route not found.' })
  } catch (error) {
    console.error('Delete category failed:', error)
    return res.status(500).json({ error: 'Server error.' })
  }
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const familyId = await getUserFamilyId(userId)
    const { id } = req.params

    if (!familyId) {
      return res.status(400).json({ error: 'You do not belong to a family.' })
    }

    const medicine = await prisma.medicine.findFirst({ where: { id, familyId } })
    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found.' })
    }

    await prisma.reminder.deleteMany({ where: { medicineId: id, familyId } })
    await prisma.medicine.delete({ where: { id } })
    return res.json({ success: true })
  } catch (error) {
    console.error('Delete medicine failed:', error)
    return res.status(500).json({ error: 'Server error.' })
  }
})

export { router as medicineRouter }
