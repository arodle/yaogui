import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Prisma, PrismaClient } from '@prisma/client'
import { AuthRequest } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET || 'medicine-cabinet-secret-key'

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let index = 0; index < 6; index += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, inviteCode } = req.body

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Please provide email, password, and name.' })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return res.status(400).json({ error: 'This email is already registered.' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    let user
    try {
      user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const createdUser = await tx.user.create({
          data: { email, password: hashedPassword, name }
        })

        const normalizedInviteCode = String(inviteCode || '').trim().toUpperCase()

        if (normalizedInviteCode) {
          const family = await tx.family.findUnique({
            where: { inviteCode: normalizedInviteCode }
          })

          if (!family) {
            throw new Error('INVITE_CODE_NOT_FOUND')
          }

          await tx.familyMember.create({
            data: {
              userId: createdUser.id,
              familyId: family.id
            }
          })
        } else {
          const family = await tx.family.create({
            data: {
              name: `${name}'s Family`,
              inviteCode: generateInviteCode(),
              createdBy: createdUser.id
            }
          })

          await tx.familyMember.create({
            data: {
              userId: createdUser.id,
              familyId: family.id
            }
          })
        }

        return createdUser
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'INVITE_CODE_NOT_FOUND') {
        return res.status(404).json({ error: 'Invite code not found.' })
      }
      throw error
    }

    const familyMember = await prisma.familyMember.findFirst({
      where: { userId: user.id },
      include: { family: true }
    })

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' })

    return res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
      familyId: familyMember?.familyId
    })
  } catch (error) {
    console.error('Registration error:', error)
    return res.status(500).json({ error: 'Server error.' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' })
    }

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' })
    }

    const familyMember = await prisma.familyMember.findFirst({
      where: { userId: user.id },
      include: { family: true }
    })

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' })

    return res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
      familyId: familyMember?.familyId
    })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({ error: 'Server error.' })
  }
})

router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'Missing auth token.' })
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found.' })
    }

    const familyMember = await prisma.familyMember.findFirst({
      where: { userId: user.id },
      orderBy: { joinedAt: 'desc' }
    })

    return res.json({ user, familyId: familyMember?.familyId })
  } catch {
    return res.status(401).json({ error: 'Invalid auth token.' })
  }
})

export { router as authRouter }
