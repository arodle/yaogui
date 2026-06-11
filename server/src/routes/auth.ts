import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { AuthRequest } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET || 'medicine-cabinet-secret-key'

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body

    if (!email || !password || !name) {
      return res.status(400).json({ error: '请提供完整的注册信息' })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(400).json({ error: '该邮箱已被注册' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    // 创建用户和家庭
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { email, password: hashedPassword, name }
      })

      // 创建家庭
      const family = await tx.family.create({
        data: {
          name: `${name}的家庭`,
          inviteCode: generateInviteCode(),
          createdBy: newUser.id
        }
      })

      // 添加家庭成员
      await tx.familyMember.create({
        data: {
          userId: newUser.id,
          familyId: family.id
        }
      })

      return newUser
    })

    // 获取用户家庭信息
    const familyMember = await prisma.familyMember.findFirst({
      where: { userId: user.id },
      include: { family: true }
    })

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' })

    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
      familyId: familyMember?.familyId
    })
  } catch (error) {
    console.error('注册错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(401).json({ error: '邮箱或密码错误' })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return res.status(401).json({ error: '邮箱或密码错误' })
    }

    // 获取用户家庭ID
    const familyMember = await prisma.familyMember.findFirst({
      where: { userId: user.id },
      include: { family: true }
    })

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' })

    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
      familyId: familyMember?.familyId
    })
  } catch (error) {
    console.error('登录错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: '未提供认证令牌' })
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true }
    })

    if (!user) {
      return res.status(404).json({ error: '用户不存在' })
    }

    // 获取家庭ID
    const familyMember = await prisma.familyMember.findFirst({
      where: { userId: user.id },
      orderBy: { joinedAt: 'asc' }
    })

    res.json({ user, familyId: familyMember?.familyId })
  } catch {
    res.status(401).json({ error: '无效的认证令牌' })
  }
})

export { router as authRouter }
