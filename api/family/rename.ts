import { NextRequest } from 'next/server'
import { prisma } from '../_db'
import { requireAuth } from '../_auth'

// PUT /api/family/rename
export async function PUT(req: NextRequest) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const { name } = await req.json()
    if (!name) {
      return new Response(JSON.stringify({ error: '请提供家庭名称' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const member = await prisma.familyMember.findFirst({
      where: { userId },
      orderBy: { joinedAt: 'asc' }
    })
    if (!member) {
      return new Response(JSON.stringify({ error: '您暂无家庭' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    const family = await prisma.family.update({
      where: { id: member.familyId },
      data: { name }
    })
    return Response.json({ family })
  } catch (error) {
    console.error('重命名家庭失败:', error)
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
