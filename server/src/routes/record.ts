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
      return res.json({ records: [] })
    }

    const { startDate, endDate } = req.query
    const where: any = { familyId }

    if (startDate) {
      where.takenAt = { ...where.takenAt, gte: new Date(startDate as string) }
    }
    if (endDate) {
      where.takenAt = { ...where.takenAt, lte: new Date(endDate as string) }
    }

    const records = await prisma.record.findMany({
      where,
      include: { medicine: { select: { name: true, unit: true } } },
      orderBy: { takenAt: 'desc' }
    })

    res.json({ records })
  } catch (error) {
    console.error('获取服药记录错误:', error)
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

    const { medicineId, takenAt, status } = req.body

    if (!medicineId || !takenAt || !status) {
      return res.status(400).json({ error: '请提供完整的服药记录信息' })
    }

    const medicine = await prisma.medicine.findFirst({
      where: { id: medicineId, familyId }
    })

    if (!medicine) {
      return res.status(404).json({ error: '药品不存在' })
    }

    const record = await prisma.record.create({
      data: {
        familyId,
        medicineId,
        takenAt: new Date(takenAt),
        status
      }
    })

    if (status === 'taken') {
      await prisma.medicine.update({
        where: { id: medicineId },
        data: { quantity: { decrement: 1 } }
      })
    }

    res.json({ record })
  } catch (error) {
    console.error('创建服药记录错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

export { router as recordRouter }
