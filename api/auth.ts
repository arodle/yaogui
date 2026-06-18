import bcrypt from 'bcryptjs'
import { prisma, generateInviteCode } from './_db'
import { makeToken, requireAuth } from './_auth'

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

export async function GET(req: Request) {
  const action = getAction(req)
  if (action !== 'me') {
    return errorResponse(`Route not found: /api/auth/${action}`, 404)
  }

  const auth = requireAuth(req)
  if (auth instanceof Response) return auth

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, name: true }
  })

  if (!user) {
    return errorResponse('User not found.', 404)
  }

  const familyMember = await prisma.familyMember.findFirst({
    where: { userId: user.id },
    orderBy: { joinedAt: 'desc' }
  })

  return json({ user, familyId: familyMember?.familyId })
}

export async function POST(req: Request) {
  const action = getAction(req)

  if (action === 'register') {
    const { email, password, name, inviteCode } = await req.json()
    if (!email || !password || !name) {
      return errorResponse('Please provide email, password, and name.')
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return errorResponse('This email is already registered.')
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    let user
    try {
      user = await prisma.$transaction(async (tx) => {
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
        return errorResponse('Invite code not found.', 404)
      }
      throw error
    }

    const familyMember = await prisma.familyMember.findFirst({
      where: { userId: user.id }
    })

    return json({
      user: { id: user.id, email: user.email, name: user.name },
      token: makeToken(user.id),
      familyId: familyMember?.familyId
    })
  }

  if (action === 'login') {
    const { email, password } = await req.json()

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return errorResponse('Invalid email or password.', 401)
    }

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      return errorResponse('Invalid email or password.', 401)
    }

    const familyMember = await prisma.familyMember.findFirst({
      where: { userId: user.id }
    })

    return json({
      user: { id: user.id, email: user.email, name: user.name },
      token: makeToken(user.id),
      familyId: familyMember?.familyId
    })
  }

  return errorResponse(`Route not found: /api/auth/${action}`, 404)
}
