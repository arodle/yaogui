import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthRequest } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// 获取当前用户的家庭信息
router.get('/my', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    if (!userId) {
      return res.status(401).json({ error: '未授权' })
    }

    // 获取用户最早加入的家庭
    const member = await prisma.familyMember.findFirst({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
      include: { family: true }
    })

    if (!member) {
      return res.json({ family: null, members: [], medicineCount: 0 })
    }

    const familyId = member.familyId

    // 获取家庭成员
    const members = await prisma.familyMember.findMany({
      where: { familyId },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    })

    // 获取药品数量
    const medicineCount = await prisma.medicine.count({
      where: { familyId }
    })

    res.json({
      family: member.family,
      members: members.map(m => ({
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        joinedAt: m.joinedAt
      })),
      medicineCount
    })
  } catch (error) {
    console.error('获取家庭信息失败:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 获取家庭成员列表
router.get('/members', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    if (!userId) {
      return res.status(401).json({ error: '未授权' })
    }

    const member = await prisma.familyMember.findFirst({
      where: { userId },
      orderBy: { joinedAt: 'asc' }
    })

    if (!member) {
      return res.json({ members: [] })
    }

    const members = await prisma.familyMember.findMany({
      where: { familyId: member.familyId },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    })

    res.json({
      members: members.map(m => ({
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        joinedAt: m.joinedAt
      }))
    })
  } catch (error) {
    console.error('获取家庭成员失败:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 创建家庭
router.post('/create', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { name } = req.body
    if (!userId) {
      return res.status(401).json({ error: '未授权' })
    }

    if (!name) {
      return res.status(400).json({ error: '请提供家庭名称' })
    }

    // 创建新家庭
    const family = await prisma.family.create({
      data: {
        name,
        inviteCode: generateInviteCode(),
        createdBy: userId
      }
    })

    // 添加创建者为成员
    await prisma.familyMember.create({
      data: {
        userId,
        familyId: family.id
      }
    })

    res.json({ family })
  } catch (error) {
    console.error('创建家庭失败:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 加入家庭
router.post('/join', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { code } = req.body
    if (!userId) {
      return res.status(401).json({ error: '未授权' })
    }

    if (!code) {
      return res.status(400).json({ error: '请提供邀请码' })
    }

    const upperCode = code.toUpperCase()

    // 查找家庭
    const family = await prisma.family.findUnique({
      where: { inviteCode: upperCode }
    })

    if (!family) {
      return res.status(404).json({ error: '邀请码无效' })
    }

    // 检查是否已是成员
    const existing = await prisma.familyMember.findUnique({
      where: {
        userId_familyId: {
          userId,
          familyId: family.id
        }
      }
    })

    if (existing) {
      return res.status(400).json({ error: '您已是该家庭成员' })
    }

    // 添加为成员
    await prisma.familyMember.create({
      data: {
        userId,
        familyId: family.id
      }
    })

    res.json({ family })
  } catch (error) {
    console.error('加入家庭失败:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 离开家庭
router.post('/leave', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    if (!userId) {
      return res.status(401).json({ error: '未授权' })
    }

    const member = await prisma.familyMember.findFirst({
      where: { userId },
      orderBy: { joinedAt: 'asc' }
    })

    if (!member) {
      return res.status(404).json({ error: '您暂无家庭' })
    }

    // 移除成员关系
    await prisma.familyMember.delete({
      where: { id: member.id }
    })

    // 创建新家庭
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true }
    })

    const newFamily = await prisma.family.create({
      data: {
        name: user?.name ? `${user.name}的家庭` : '我的家庭',
        inviteCode: generateInviteCode(),
        createdBy: userId
      }
    })

    await prisma.familyMember.create({
      data: {
        userId,
        familyId: newFamily.id
      }
    })

    res.json({ family: newFamily })
  } catch (error) {
    console.error('离开家庭失败:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 重命名家庭
router.put('/rename', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { name } = req.body
    if (!userId) {
      return res.status(401).json({ error: '未授权' })
    }

    if (!name) {
      return res.status(400).json({ error: '请提供家庭名称' })
    }

    const member = await prisma.familyMember.findFirst({
      where: { userId },
      orderBy: { joinedAt: 'asc' }
    })

    if (!member) {
      return res.status(404).json({ error: '您暂无家庭' })
    }

    const family = await prisma.family.update({
      where: { id: member.familyId },
      data: { name }
    })

    res.json({ family })
  } catch (error) {
    console.error('重命名家庭失败:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 重新生成邀请码
router.post('/regenerate-code', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    if (!userId) {
      return res.status(401).json({ error: '未授权' })
    }

    const member = await prisma.familyMember.findFirst({
      where: { userId },
      orderBy: { joinedAt: 'asc' }
    })

    if (!member) {
      return res.status(404).json({ error: '您暂无家庭' })
    }

    const family = await prisma.family.update({
      where: { id: member.familyId },
      data: { inviteCode: generateInviteCode() }
    })

    res.json({ family })
  } catch (error) {
    console.error('重新生成邀请码失败:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 移除家庭成员
router.delete('/members/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.userId!
    const { userId } = req.params
    if (!currentUserId) {
      return res.status(401).json({ error: '未授权' })
    }

    if (currentUserId === userId) {
      return res.status(400).json({ error: '不能移除自己' })
    }

    const member = await prisma.familyMember.findFirst({
      where: { userId: currentUserId },
      orderBy: { joinedAt: 'asc' }
    })

    if (!member) {
      return res.status(404).json({ error: '您暂无家庭' })
    }

    await prisma.familyMember.deleteMany({
      where: {
        userId,
        familyId: member.familyId
      }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('移除成员失败:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

export { router as familyRouter }
