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
      return res.json({ reminders: [] })
    }

    const reminders = await prisma.reminder.findMany({
      where: { familyId },
      include: { medicine: { select: { name: true, quantity: true, unit: true } } },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ reminders })
  } catch (error) {
    console.error('获取提醒错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const familyId = await getUserFamilyId(userId)
    const { id } = req.params
    const { enabled, times } = req.body

    if (!familyId) {
      return res.status(400).json({ error: '您暂无家庭' })
    }

    const reminder = await prisma.reminder.findFirst({
      where: { id, familyId }
    })

    if (!reminder) {
      return res.status(404).json({ error: '提醒不存在' })
    }

    const updated = await prisma.reminder.update({
      where: { id },
      data: {
        enabled: enabled ?? reminder.enabled,
        times: times ?? reminder.times
      }
    })

    res.json({ reminder: updated })
  } catch (error) {
    console.error('更新提醒错误:', error)
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

    const reminder = await prisma.reminder.findFirst({
      where: { id, familyId }
    })

    if (!reminder) {
      return res.status(404).json({ error: '提醒不存在' })
    }

    await prisma.reminder.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    console.error('删除提醒错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

export { router as reminderRouter }
