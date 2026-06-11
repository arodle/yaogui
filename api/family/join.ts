import { prisma } from '../_db'
import { requireAuth } from '../_auth'

export async function POST(req: Request) {
  const auth = requireAuth(req)
  if (auth instanceof Response) return auth
  const { userId } = auth

  try {
    const { code } = await req.json()
    if (!code) {
      return new Response(JSON.stringify({ error: '请提供邀请码' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const upperCode = code.toUpperCase()
    const family = await prisma.family.findUnique({ where: { inviteCode: upperCode } })
    if (!family) {
      return new Response(JSON.stringify({ error: '邀请码无效' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    const existing = await prisma.familyMember.findUnique({
      where: { userId_familyId: { userId, familyId: family.id } }
    })
    if (existing) {
      return new Response(JSON.stringify({ error: '您已是该家庭成员' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    await prisma.familyMember.create({ data: { userId, familyId: family.id } })
    return Response.json({ family })
  } catch (error) {
    console.error('加入家庭失败:', error)
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
