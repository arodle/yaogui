import { Router, Response } from 'express'
import { Prisma, PrismaClient } from '@prisma/client'
import { AuthRequest } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

type FamilyMemberWithUser = Prisma.FamilyMemberGetPayload<{
  include: { user: { select: { id: true; name: true; email: true } } }
}>


function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let index = 0; index < 6; index += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

async function getPrimaryFamilyMember(userId: string) {
  return prisma.familyMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: 'desc' },
    include: { family: true }
  })
}

function mapRole(ownerId: string, memberUserId: string) {
  return ownerId === memberUserId ? 'owner' : 'member'
}

router.get('/my', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' })
    }

    const member = await getPrimaryFamilyMember(userId)
    if (!member) {
      return res.json({ family: null, members: [], medicineCount: 0 })
    }

    const members = await prisma.familyMember.findMany({
      where: { familyId: member.familyId },
      include: { user: { select: { id: true, name: true, email: true } } }
    })
    const medicineCount = await prisma.medicine.count({ where: { familyId: member.familyId } })

    return res.json({
      family: member.family,
      members: members.map((familyMember: FamilyMemberWithUser) => ({
        userId: familyMember.user.id,
        name: familyMember.user.name,
        email: familyMember.user.email,
        joinedAt: familyMember.joinedAt,
        role: mapRole(member.family.createdBy, familyMember.user.id)
      })),
      medicineCount,
      currentUserRole: mapRole(member.family.createdBy, userId)
    })
  } catch (error) {
    console.error('Get family failed:', error)
    return res.status(500).json({ error: 'Server error.' })
  }
})

router.get('/members', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' })
    }

    const member = await getPrimaryFamilyMember(userId)
    if (!member) {
      return res.json({ members: [] })
    }

    const members = await prisma.familyMember.findMany({
      where: { familyId: member.familyId },
      include: { user: { select: { id: true, name: true, email: true } } }
    })

    return res.json({
      members: members.map((familyMember: FamilyMemberWithUser) => ({
        userId: familyMember.user.id,
        name: familyMember.user.name,
        email: familyMember.user.email,
        joinedAt: familyMember.joinedAt,
        role: mapRole(member.family.createdBy, familyMember.user.id)
      }))
    })
  } catch (error) {
    console.error('Get family members failed:', error)
    return res.status(500).json({ error: 'Server error.' })
  }
})

router.post('/create', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { name } = req.body
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' })
    }
    if (!name) {
      return res.status(400).json({ error: 'Please provide a family name.' })
    }

    const family = await prisma.family.create({
      data: {
        name,
        inviteCode: generateInviteCode(),
        createdBy: userId
      }
    })

    await prisma.familyMember.create({
      data: {
        userId,
        familyId: family.id
      }
    })

    return res.json({ family })
  } catch (error) {
    console.error('Create family failed:', error)
    return res.status(500).json({ error: 'Server error.' })
  }
})

router.post('/join', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { code } = req.body
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' })
    }
    if (!code) {
      return res.status(400).json({ error: 'Please provide an invite code.' })
    }

    const family = await prisma.family.findUnique({
      where: { inviteCode: String(code).toUpperCase() }
    })
    if (!family) {
      return res.status(404).json({ error: 'Invite code not found.' })
    }

    const existing = await prisma.familyMember.findUnique({
      where: {
        userId_familyId: {
          userId,
          familyId: family.id
        }
      }
    })
    if (existing) {
      return res.status(400).json({ error: 'You are already a member of this family.' })
    }

    await prisma.familyMember.create({
      data: {
        userId,
        familyId: family.id
      }
    })

    return res.json({ family })
  } catch (error) {
    console.error('Join family failed:', error)
    return res.status(500).json({ error: 'Server error.' })
  }
})

router.post('/leave', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' })
    }

    const member = await getPrimaryFamilyMember(userId)
    if (!member) {
      return res.status(404).json({ error: 'You do not belong to a family.' })
    }

    if (member.family.createdBy === userId) {
      const familyMemberCount = await prisma.familyMember.count({
        where: { familyId: member.familyId }
      })
      if (familyMemberCount > 1) {
        return res.status(403).json({ error: 'Please transfer ownership before leaving the family.' })
      }
    }

    await prisma.familyMember.delete({ where: { id: member.id } })

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true }
    })

    const newFamily = await prisma.family.create({
      data: {
        name: user?.name ? `${user.name}'s Family` : 'My Family',
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

    return res.json({ family: newFamily })
  } catch (error) {
    console.error('Leave family failed:', error)
    return res.status(500).json({ error: 'Server error.' })
  }
})

router.put('/rename', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { name } = req.body
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' })
    }
    if (!name) {
      return res.status(400).json({ error: 'Please provide a family name.' })
    }

    const member = await getPrimaryFamilyMember(userId)
    if (!member) {
      return res.status(404).json({ error: 'You do not belong to a family.' })
    }
    if (member.family.createdBy !== userId) {
      return res.status(403).json({ error: 'Only the family owner can rename the family.' })
    }

    const family = await prisma.family.update({
      where: { id: member.familyId },
      data: { name }
    })

    return res.json({ family })
  } catch (error) {
    console.error('Rename family failed:', error)
    return res.status(500).json({ error: 'Server error.' })
  }
})

router.post('/regenerate-code', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' })
    }

    const member = await getPrimaryFamilyMember(userId)
    if (!member) {
      return res.status(404).json({ error: 'You do not belong to a family.' })
    }
    if (member.family.createdBy !== userId) {
      return res.status(403).json({ error: 'Only the family owner can regenerate the invite code.' })
    }

    const family = await prisma.family.update({
      where: { id: member.familyId },
      data: { inviteCode: generateInviteCode() }
    })

    return res.json({ family })
  } catch (error) {
    console.error('Regenerate invite code failed:', error)
    return res.status(500).json({ error: 'Server error.' })
  }
})

router.post('/transfer-owner', async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.userId!
    const { userId } = req.body
    if (!currentUserId) {
      return res.status(401).json({ error: 'Unauthorized.' })
    }
    if (!userId) {
      return res.status(400).json({ error: 'Please provide the target user id.' })
    }

    const member = await getPrimaryFamilyMember(currentUserId)
    if (!member) {
      return res.status(404).json({ error: 'You do not belong to a family.' })
    }
    if (member.family.createdBy !== currentUserId) {
      return res.status(403).json({ error: 'Only the family owner can transfer ownership.' })
    }
    if (userId === currentUserId) {
      return res.status(400).json({ error: 'You are already the family owner.' })
    }

    const targetMember = await prisma.familyMember.findFirst({
      where: { userId, familyId: member.familyId }
    })
    if (!targetMember) {
      return res.status(404).json({ error: 'Target user is not in your family.' })
    }

    const family = await prisma.family.update({
      where: { id: member.familyId },
      data: { createdBy: userId }
    })

    return res.json({ family })
  } catch (error) {
    console.error('Transfer ownership failed:', error)
    return res.status(500).json({ error: 'Server error.' })
  }
})

router.delete('/members/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.userId!
    const { userId } = req.params
    if (!currentUserId) {
      return res.status(401).json({ error: 'Unauthorized.' })
    }
    if (currentUserId === userId) {
      return res.status(400).json({ error: 'You cannot remove yourself.' })
    }

    const member = await getPrimaryFamilyMember(currentUserId)
    if (!member) {
      return res.status(404).json({ error: 'You do not belong to a family.' })
    }
    if (member.family.createdBy !== currentUserId) {
      return res.status(403).json({ error: 'Only the family owner can remove members.' })
    }

    await prisma.familyMember.deleteMany({
      where: {
        userId,
        familyId: member.familyId
      }
    })

    return res.json({ success: true })
  } catch (error) {
    console.error('Remove member failed:', error)
    return res.status(500).json({ error: 'Server error.' })
  }
})

export { router as familyRouter }
