import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '../_db'
import { makeToken } from '../_auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return new Response(JSON.stringify({ error: '邮箱或密码错误' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return new Response(JSON.stringify({ error: '邮箱或密码错误' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

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
    console.error('登录错误:', error)
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
