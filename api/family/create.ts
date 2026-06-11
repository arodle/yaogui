import { NextRequest } from 'next/server'
import { prisma, generateInviteCode } from '../_db'
import { requireAuth } from '../_auth'

// POST /api/family/create
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const { name } = await req.json()
    if (!name) {
      return new Response(JSON.stringify({ error: '请提供家庭名称' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const family = await prisma.family.create({
      data: { name, inviteCode: generateInviteCode(), createdBy: userId }
    })

    await prisma.familyMember.create({
      data: { userId, familyId: family.id }
    })

    return Response.json({ family })
  } catch (error) {
    console.error('创建家庭失败:', error)
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
