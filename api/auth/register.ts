import bcrypt from 'bcryptjs'
import { prisma, generateInviteCode } from '../_db'
import { makeToken } from '../_auth'

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json()

    if (!email || !password || !name) {
      return new Response(JSON.stringify({ error: '请提供完整的注册信息' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return new Response(JSON.stringify({ error: '该邮箱已被注册' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({ data: { email, password: hashedPassword, name } })
      const family = await tx.family.create({
        data: { name: `${name}的家庭`, inviteCode: generateInviteCode(), createdBy: newUser.id }
      })
      await tx.familyMember.create({ data: { userId: newUser.id, familyId: family.id } })
      return newUser
    })

    const familyMember = await prisma.familyMember.findFirst({
      where: { userId: user.id },
      include: { family: true }
    })

    const token = makeToken(user.id)

    return Response.json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
      familyId: familyMember?.familyId
    })
  } catch (error) {
    console.error('注册错误:', error)
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
