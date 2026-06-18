import { prisma, generateInviteCode } from './_db'
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

function getAction(req: Request) {
  return new URL(req.url).searchParams.get('action') ?? ''
}

async function getPrimaryFamilyMember(userId: string) {
  return prisma.familyMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: 'desc' },
    include: { family: true }
  })
}

function assertOwner(member: Awaited<ReturnType<typeof getPrimaryFamilyMember>>) {
  if (!member) {
    return errorResponse('You do not belong to a family.', 404)
  }
  if (member.family.createdBy !== member.userId) {
    return errorResponse('Only the family owner can perform this action.', 403)
  }
  return null
}

export async function GET(req: Request) {
  const action = getAction(req)
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth

  if (action === 'my') {
    const member = await getPrimaryFamilyMember(auth.userId)
    if (!member) {
      return json({ family: null, members: [], medicineCount: 0 })
    }

    const members = await prisma.familyMember.findMany({
      where: { familyId: member.familyId },
      include: { user: { select: { id: true, name: true, email: true } } }
    })

    const medicineCount = await prisma.medicine.count({ where: { familyId: member.familyId } })

    return json({
      family: member.family,
      members: members.map((familyMember) => ({
        userId: familyMember.user.id,
        name: familyMember.user.name,
        email: familyMember.user.email,
        joinedAt: familyMember.joinedAt,
        role: member.family.createdBy === familyMember.user.id ? 'owner' : 'member'
      })),
      medicineCount,
      currentUserRole: member.family.createdBy === auth.userId ? 'owner' : 'member'
    })
  }

  if (action === 'members') {
    const member = await getPrimaryFamilyMember(auth.userId)
    if (!member) return json({ members: [] })

    const members = await prisma.familyMember.findMany({
      where: { familyId: member.familyId },
      include: { user: { select: { id: true, name: true, email: true } } }
    })

    return json({
      members: members.map((familyMember) => ({
        userId: familyMember.user.id,
        name: familyMember.user.name,
        email: familyMember.user.email,
        joinedAt: familyMember.joinedAt,
        role: member.family.createdBy === familyMember.user.id ? 'owner' : 'member'
      }))
    })
  }

  return errorResponse(`Route not found: /api/family/${action}`, 404)
}

export async function POST(req: Request) {
  const action = getAction(req)
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth

  if (action === 'create') {
    const { name } = await req.json()
    if (!name) {
      return errorResponse('Please provide a family name.')
    }

    const family = await prisma.family.create({
      data: { name, inviteCode: generateInviteCode(), createdBy: auth.userId }
    })

    await prisma.familyMember.create({
      data: { userId: auth.userId, familyId: family.id }
    })

    return json({ family })
  }

  if (action === 'join') {
    const { code } = await req.json()
    if (!code) {
      return errorResponse('Please provide an invite code.')
    }

    const family = await prisma.family.findUnique({
      where: { inviteCode: String(code).toUpperCase() }
    })
    if (!family) {
      return errorResponse('Invite code not found.', 404)
    }

    const existingMember = await prisma.familyMember.findUnique({
      where: { userId_familyId: { userId: auth.userId, familyId: family.id } }
    })
    if (existingMember) {
      return errorResponse('You are already a member of this family.')
    }

    await prisma.familyMember.create({
      data: { userId: auth.userId, familyId: family.id }
    })

    return json({ family })
  }

  if (action === 'leave') {
    const member = await getPrimaryFamilyMember(auth.userId)
    if (!member) {
      return errorResponse('You do not belong to a family.', 404)
    }

    if (member.family.createdBy === auth.userId) {
      const familyMemberCount = await prisma.familyMember.count({
        where: { familyId: member.familyId }
      })
      if (familyMemberCount > 1) {
        return errorResponse('Please transfer ownership before leaving the family.', 403)
      }
    }

    await prisma.familyMember.delete({ where: { id: member.id } })

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { name: true }
    })

    const newFamily = await prisma.family.create({
      data: {
        name: user?.name ? `${user.name}'s Family` : 'My Family',
        inviteCode: generateInviteCode(),
        createdBy: auth.userId
      }
    })

    await prisma.familyMember.create({
      data: { userId: auth.userId, familyId: newFamily.id }
    })

    return json({ family: newFamily })
  }

  if (action === 'regenerate-code') {
    const member = await getPrimaryFamilyMember(auth.userId)
    const ownerError = assertOwner(member)
    if (ownerError) return ownerError

    const family = await prisma.family.update({
      where: { id: member.familyId },
      data: { inviteCode: generateInviteCode() }
    })

    return json({ family })
  }

  if (action === 'transfer-owner') {
    const { userId } = await req.json()
    if (!userId) {
      return errorResponse('Please provide the target user id.')
    }

    const member = await getPrimaryFamilyMember(auth.userId)
    const ownerError = assertOwner(member)
    if (ownerError) return ownerError

    if (userId === auth.userId) {
      return errorResponse('You are already the family owner.')
    }

    const targetMember = await prisma.familyMember.findFirst({
      where: { userId, familyId: member.familyId }
    })
    if (!targetMember) {
      return errorResponse('Target user is not in your family.', 404)
    }

    const family = await prisma.family.update({
      where: { id: member.familyId },
      data: { createdBy: userId }
    })

    return json({ family })
  }

  return errorResponse(`Route not found: /api/family/${action}`, 404)
}

export async function PUT(req: Request) {
  const action = getAction(req)
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth

  if (action !== 'rename') {
    return errorResponse(`Route not found: /api/family/${action}`, 404)
  }

  const { name } = await req.json()
  if (!name) {
    return errorResponse('Please provide a family name.')
  }

  const member = await getPrimaryFamilyMember(auth.userId)
  const ownerError = assertOwner(member)
  if (ownerError) return ownerError

  const family = await prisma.family.update({
    where: { id: member.familyId },
    data: { name }
  })

  return json({ family })
}

export async function DELETE(req: Request) {
  const url = new URL(req.url)
  const action = url.searchParams.get('action') ?? ''
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth

  if (action !== 'member-delete') {
    return errorResponse(`Route not found: /api/family/${action}`, 404)
  }

  const targetUserId = url.searchParams.get('userId')
  if (!targetUserId) {
    return errorResponse('Missing target user id.')
  }
  if (targetUserId === auth.userId) {
    return errorResponse('You cannot remove yourself.')
  }

  const member = await getPrimaryFamilyMember(auth.userId)
  const ownerError = assertOwner(member)
  if (ownerError) return ownerError

  await prisma.familyMember.deleteMany({
    where: { userId: targetUserId, familyId: member.familyId }
  })

  return json({ success: true })
}
