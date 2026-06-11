import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthRequest } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

// 获取用户的家庭ID
async function getUserFamilyId(userId: string): Promise<string | null> {
  const member = await prisma.familyMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: 'asc' }
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

    const medicines = await prisma.medicine.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ medicines })
  } catch (error) {
    console.error('获取药品列表错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const familyId = await getUserFamilyId(userId)

    if (!familyId) {
      return res.status(400).json({ error: '您暂无家庭' })
    }

    const { name, category, diseaseCategory, photo, quantity, unit, expiryDate, threshold, reminderTimes } = req.body

    if (!name || !category || quantity === undefined || !unit) {
      return res.status(400).json({ error: '请提供完整的药品信息' })
    }

    const medicine = await prisma.medicine.create({
      data: {
        familyId,
        name,
        category,
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
        data: {
          familyId,
          medicineId: medicine.id,
          times: reminderTimes
        }
      })
    }

    res.json({ medicine })
  } catch (error) {
    console.error('添加药品错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const familyId = await getUserFamilyId(userId)
    const { id } = req.params
    const { name, category, diseaseCategory, photo, quantity, unit, expiryDate, threshold, reminderTimes } = req.body

    if (!familyId) {
      return res.status(400).json({ error: '您暂无家庭' })
    }

    const medicine = await prisma.medicine.findFirst({
      where: { id, familyId }
    })

    if (!medicine) {
      return res.status(404).json({ error: '药品不存在' })
    }

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
      await prisma.reminder.updateMany({
        where: { medicineId: id },
        data: { times: reminderTimes }
      })
    }

    res.json({ medicine: updated })
  } catch (error) {
    console.error('更新药品错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const familyId = await getUserFamilyId(userId)
    const { id } = req.params

    if (!familyId) {
      return res.status(400).json({ error: '您暂无家庭' })
    }

    const medicine = await prisma.medicine.findFirst({
      where: { id, familyId }
    })

    if (!medicine) {
      return res.status(404).json({ error: '药品不存在' })
    }

    await prisma.medicine.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    console.error('删除药品错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

export { router as medicineRouter }
