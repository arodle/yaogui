const DEMO_MODE_KEY = 'medicine-cabinet-demo'
const DEMO_USER_KEY = 'medicine-cabinet-demo-user'
const DEMO_TOKEN = 'demo-token'
const API_BASE = '/api'
const FAM_STORE = 'demo-families'       // 家庭表
const MEMBER_STORE = 'demo-members'     // 成员表（userId -> familyId[]）
const MED_STORE = 'demo-medicines'      // 药品库（带 familyId）
const REC_STORE = 'demo-records'        // 服药记录
const REM_STORE = 'demo-reminders'      // 服药提醒

function getDemoUser(): { id: string; email: string; name: string } | null {
  const raw = localStorage.getItem(DEMO_USER_KEY)
  return raw ? JSON.parse(raw) : null
}

function setDemoUser(user: any) {
  localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user))
}

function enableDemo() {
  localStorage.setItem(DEMO_MODE_KEY, '1')
}

function isDemo(): boolean {
  return localStorage.getItem(DEMO_MODE_KEY) === '1'
}

function genId(prefix: string = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
}

function genInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function getStore(key: string, def: any = []): any {
  const raw = localStorage.getItem(key)
  return raw ? JSON.parse(raw) : def
}

function setStore(key: string, data: any) {
  localStorage.setItem(key, JSON.stringify(data))
}

function getUserId(): string | null {
  const u = getDemoUser()
  return u ? u.id : null
}

// ---------- 家庭工具函数 ----------
function getFamilyMembers(familyId: string): any[] {
  const members = getStore(MEMBER_STORE, [])
  return members.filter((m: any) => m.familyId === familyId)
}

function getUserFamilyId(userId: string): string | null {
  const members = getStore(MEMBER_STORE, [])
  const list = members.filter((m: any) => m.userId === userId).sort((a: any, b: any) => a.joinedAt.localeCompare(b.joinedAt))
  return list.length > 0 ? list[0].familyId : null
}

function ensureUserHasFamily(userId: string, userName: string, email: string): string {
  // 若用户已经有家庭，直接返回
  const existing = getUserFamilyId(userId)
  if (existing) return existing

  // 否则创建一个家庭（以用户名称命名）
  const families = getStore(FAM_STORE, [])
  const familyId = genId('fam')
  const family = {
    id: familyId,
    name: `${userName || email || '我的'}的药箱`,
    inviteCode: genInviteCode(),
    createdBy: userId,
    createdAt: new Date().toISOString()
  }
  families.push(family)
  setStore(FAM_STORE, families)

  const members = getStore(MEMBER_STORE, [])
  members.push({
    userId,
    familyId,
    joinedAt: new Date().toISOString(),
    name: userName || email || '我',
    role: 'owner'
  })
  setStore(MEMBER_STORE, members)

  return familyId
}

// 获取当前活跃家庭：若用户是多个家庭成员，仍取最早加入的一个
function getActiveFamilyId(): string | null {
  const userId = getUserId()
  if (!userId) return null
  return getUserFamilyId(userId)
}

function getFamilyById(familyId: string): any {
  const families = getStore(FAM_STORE, [])
  return families.find((f: any) => f.id === familyId) || null
}

// ---------- 演示数据 ----------
function seedDemoIfEmpty() {
  if (!isDemo()) return
  const user = getDemoUser()
  if (!user) return

  const familyId = ensureUserHasFamily(user.id, user.name, user.email)
  const meds = getStore(MED_STORE, []).filter((m: any) => m.familyId === familyId)
  if (meds.length > 0) return

  const sampleMeds = [
    { id: genId(), familyId, name: '阿莫西林胶囊', category: 'western', diseaseCategory: 'respiratory', photo: null, quantity: 12, unit: '粒', expiryDate: '2026-12-31', threshold: 5, createdAt: new Date().toISOString() },
    { id: genId(), familyId, name: '维生素 C 片', category: 'health', diseaseCategory: 'immunity', photo: null, quantity: 30, unit: '片', expiryDate: '2027-06-30', threshold: 10, createdAt: new Date().toISOString() },
    { id: genId(), familyId, name: '板蓝根颗粒', category: 'chinese', diseaseCategory: 'respiratory', photo: null, quantity: 8, unit: '袋', expiryDate: '2026-10-15', threshold: 5, createdAt: new Date().toISOString() },
    { id: genId(), familyId, name: '布洛芬缓释胶囊', category: 'western', diseaseCategory: 'pain', photo: null, quantity: 20, unit: '粒', expiryDate: '2027-03-20', threshold: 5, createdAt: new Date().toISOString() },
    { id: genId(), familyId, name: '复方丹参滴丸', category: 'chinese', diseaseCategory: 'cardiovascular', photo: null, quantity: 60, unit: '粒', expiryDate: '2026-08-30', threshold: 20, createdAt: new Date().toISOString() },
    { id: genId(), familyId, name: '创可贴', category: 'topical', diseaseCategory: 'trauma', photo: null, quantity: 20, unit: '片', expiryDate: null, threshold: 10, createdAt: new Date().toISOString() }
  ]
  setStore(MED_STORE, [...getStore(MED_STORE, []), ...sampleMeds])

  const reminders = [
    { id: genId(), familyId, medicineId: sampleMeds[0].id, medicineName: sampleMeds[0].name, enabled: true, times: ['08:00', '20:00'], createdAt: new Date().toISOString() },
    { id: genId(), familyId, medicineId: sampleMeds[1].id, medicineName: sampleMeds[1].name, enabled: true, times: ['09:00'], createdAt: new Date().toISOString() }
  ]
  setStore(REM_STORE, [...getStore(REM_STORE, []), ...reminders])

  const now = new Date()
  const records = [
    { id: genId(), familyId, medicineId: sampleMeds[0].id, medicine: { name: sampleMeds[0].name, unit: sampleMeds[0].unit }, takenAt: new Date(now.getTime() - 3600_000).toISOString(), status: 'taken', takenBy: user.name, createdAt: new Date().toISOString() },
    { id: genId(), familyId, medicineId: sampleMeds[1].id, medicine: { name: sampleMeds[1].name, unit: sampleMeds[1].unit }, takenAt: new Date(now.getTime() - 7200_000).toISOString(), status: 'taken', takenBy: user.name, createdAt: new Date().toISOString() }
  ]
  setStore(REC_STORE, [...getStore(REC_STORE, []), ...records])
}

// ---------- API 路由 ----------
async function request(endpoint: string, options: RequestInit = {}): Promise<any> {
  // 演示模式 - 使用 localStorage
  if (isDemo()) {
    return mockRequest(endpoint, options)
  }

  const token = (() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('auth-storage') || '{}')
      return parsed.state?.token
    } catch {
      return null
    }
  })()

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers
  }
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  try {
    const response = await fetch(API_BASE + endpoint, { ...options, headers })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '请求失败' }))
      throw new Error(error.error || '请求失败')
    }
    return response.json()
  } catch (err) {
    if (endpoint.startsWith('/auth') || endpoint.startsWith('/family')) {
      throw err
    }
    return mockRequest(endpoint, options)
  }
}

function mockRequest(endpoint: string, options: RequestInit = {}): any {
  const body = options.body ? JSON.parse(options.body as string) : {}
  const method = options.method || 'GET'
  const userId = getUserId()
  const familyId = getActiveFamilyId()

  // ---------- Auth ----------
  if (endpoint === '/auth/register') {
    const user = { id: genId('usr'), email: body.email, name: body.name }
    setDemoUser(user)
    // 注册时为用户创建一个家庭
    ensureUserHasFamily(user.id, user.name, user.email)
    return { user, token: DEMO_TOKEN }
  }

  if (endpoint === '/auth/login') {
    const existing = getDemoUser()
    const user = existing || { id: genId('usr'), email: body.email, name: body.email.split('@')[0] }
    setDemoUser(user)
    ensureUserHasFamily(user.id, user.name, user.email)
    return { user, token: DEMO_TOKEN }
  }

  if (endpoint === '/auth/me') {
    const user = getDemoUser()
    if (!user) throw new Error('未登录')
    const family = familyId ? getFamilyById(familyId) : null
    const memberCount = familyId ? getFamilyMembers(familyId).length : 1
    return { user, family, memberCount }
  }

  if (!userId) throw new Error('请先登录')

  // ---------- 家庭接口 ----------
  if (endpoint === '/family/my') {
    const fid = getActiveFamilyId()
    if (!fid) return { family: null, members: [], medicineCount: 0 }
    const family = getFamilyById(fid)
    const members = getFamilyMembers(fid)
    const meds = getStore(MED_STORE, []).filter((m: any) => m.familyId === fid).length
    return { family, members, medicineCount: meds }
  }

  if (endpoint === '/family/members') {
    const fid = getActiveFamilyId()
    if (!fid) return { members: [] }
    return { members: getFamilyMembers(fid) }
  }

  if (endpoint === '/family/create' && method === 'POST') {
    const user = getDemoUser()!
    // 用户只能创建新家庭（最多 1 个），如果已有家庭，返回现有
    const existingFid = getUserFamilyId(user.id)
    if (existingFid) {
      return { family: getFamilyById(existingFid), message: '您已经有家庭，无需创建' }
    }
    const families = getStore(FAM_STORE, [])
    const fid = genId('fam')
    const family = {
      id: fid,
      name: (body.name || `${user.name}的药箱`).trim(),
      inviteCode: genInviteCode(),
      createdBy: user.id,
      createdAt: new Date().toISOString()
    }
    families.push(family)
    setStore(FAM_STORE, families)

    const members = getStore(MEMBER_STORE, [])
    members.push({
      userId: user.id,
      familyId: fid,
      joinedAt: new Date().toISOString(),
      name: user.name,
      role: 'owner'
    })
    setStore(MEMBER_STORE, members)

    return { family, members: [members[members.length - 1]], message: '家庭创建成功' }
  }

  if (endpoint === '/family/join' && method === 'POST') {
    const user = getDemoUser()!
    const code = String(body.code || '').toUpperCase().trim()
    if (!code) throw new Error('请输入邀请码')
    const families = getStore(FAM_STORE, [])
    const family = families.find((f: any) => f.inviteCode === code)
    if (!family) throw new Error('邀请码无效，请确认后重试')

    // 避免重复加入
    const members = getStore(MEMBER_STORE, [])
    const existed = members.find((m: any) => m.familyId === family.id && m.userId === user.id)
    if (!existed) {
      members.push({
        userId: user.id,
        familyId: family.id,
        joinedAt: new Date().toISOString(),
        name: user.name,
        role: 'member'
      })
      setStore(MEMBER_STORE, members)
    }

    return { family, message: `已成功加入「${family.name}」` }
  }

  if (endpoint === '/family/leave' && method === 'POST') {
    const user = getDemoUser()!
    const members = getStore(MEMBER_STORE, [])
    const updated = members.filter((m: any) => !(m.userId === user.id && m.familyId === familyId))
    setStore(MEMBER_STORE, updated)
    // 离开后自动为该用户创建新家庭
    ensureUserHasFamily(user.id, user.name, user.email)
    return { message: '已退出家庭' }
  }

  if (endpoint === '/family/rename' && method === 'PUT') {
    const fid = getActiveFamilyId()
    if (!fid) throw new Error('您暂无家庭')
    const families = getStore(FAM_STORE, [])
    const idx = families.findIndex((f: any) => f.id === fid)
    if (idx < 0) throw new Error('家庭不存在')
    families[idx] = { ...families[idx], name: (body.name || families[idx].name).trim() }
    setStore(FAM_STORE, families)
    return { family: families[idx], message: '已更新家庭名称' }
  }

  if (endpoint === '/family/regenerate-code' && method === 'POST') {
    const fid = getActiveFamilyId()
    if (!fid) throw new Error('您暂无家庭')
    const families = getStore(FAM_STORE, [])
    const idx = families.findIndex((f: any) => f.id === fid)
    if (idx < 0) throw new Error('家庭不存在')
    families[idx] = { ...families[idx], inviteCode: genInviteCode() }
    setStore(FAM_STORE, families)
    return { family: families[idx], message: '邀请码已重置' }
  }

  if (endpoint.startsWith('/family/members/') && method === 'DELETE') {
    const fid = getActiveFamilyId()
    if (!fid) throw new Error('您暂无家庭')
    const targetUserId = endpoint.split('/').pop()
    const members = getStore(MEMBER_STORE, [])
    const updated = members.filter((m: any) => !(m.familyId === fid && m.userId === targetUserId && m.userId !== userId))
    setStore(MEMBER_STORE, updated)
    return { message: '已移除成员' }
  }

  // ---------- Medicines ----------
  if (endpoint === '/medicines' && method === 'GET') {
    const fid = getActiveFamilyId()
    if (!fid) return { medicines: [] }
    const items = getStore(MED_STORE, []).filter((m: any) => m.familyId === fid)
    return { medicines: items }
  }

  if (endpoint === '/medicines' && method === 'POST') {
    const fid = getActiveFamilyId()
    if (!fid) throw new Error('您暂无家庭，请先创建或加入家庭')
    const items = getStore(MED_STORE, [])
    const medicine = {
      id: genId('med'),
      familyId: fid,
      name: body.name,
      category: body.category,
      diseaseCategory: body.diseaseCategory,
      photo: body.photo || null,
      quantity: Number(body.quantity) || 0,
      unit: body.unit,
      expiryDate: body.expiryDate || null,
      threshold: Number(body.threshold) || 10,
      createdBy: userId,
      createdAt: new Date().toISOString()
    }
    items.push(medicine)
    setStore(MED_STORE, items)
    return { medicine }
  }

  if (endpoint.startsWith('/medicines/') && method === 'PUT') {
    const id = endpoint.split('/')[2]
    const items = getStore(MED_STORE, [])
    const idx = items.findIndex((m: any) => m.id === id)
    if (idx < 0) throw new Error('药品不存在')
    items[idx] = {
      ...items[idx],
      name: body.name ?? items[idx].name,
      category: body.category ?? items[idx].category,
      diseaseCategory: body.diseaseCategory ?? items[idx].diseaseCategory,
      photo: body.photo !== undefined ? body.photo : items[idx].photo,
      quantity: body.quantity !== undefined ? Number(body.quantity) : items[idx].quantity,
      unit: body.unit ?? items[idx].unit,
      expiryDate: body.expiryDate !== undefined ? body.expiryDate : items[idx].expiryDate,
      threshold: body.threshold !== undefined ? Number(body.threshold) : items[idx].threshold
    }
    setStore(MED_STORE, items)
    return { medicine: items[idx] }
  }

  if (endpoint.startsWith('/medicines/') && method === 'DELETE') {
    const id = endpoint.split('/')[2]
    const items = getStore(MED_STORE, []).filter((m: any) => m.id !== id)
    setStore(MED_STORE, items)
    // 同时清理相关提醒
    const reminders = getStore(REM_STORE, []).filter((r: any) => r.medicineId !== id)
    setStore(REM_STORE, reminders)
    return { success: true }
  }

  // ---------- Records ----------
  if (endpoint.startsWith('/records') && method === 'GET') {
    const fid = getActiveFamilyId()
    if (!fid) return { records: [] }
    const items = getStore(REC_STORE, [])
      .filter((r: any) => r.familyId === fid)
      .sort((a: any, b: any) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())
    return { records: items }
  }

  if (endpoint === '/records' && method === 'POST') {
    const fid = getActiveFamilyId()
    if (!fid) throw new Error('您暂无家庭')
    const items = getStore(REC_STORE, [])
    const meds = getStore(MED_STORE, [])
    const med = meds.find((m: any) => m.id === body.medicineId)
    const record = {
      id: genId('rec'),
      familyId: fid,
      medicineId: body.medicineId,
      medicine: med ? { name: med.name, unit: med.unit } : { name: '药品', unit: '片' },
      takenAt: body.takenAt,
      status: body.status,
      takenBy: (getDemoUser()?.name) || '我',
      createdAt: new Date().toISOString()
    }
    items.push(record)
    setStore(REC_STORE, items)

    // 扣减库存
    if (body.status === 'taken' && med) {
      const idx = meds.findIndex((m: any) => m.id === body.medicineId)
      if (idx >= 0) {
        meds[idx] = { ...meds[idx], quantity: Math.max(0, Number(meds[idx].quantity) - 1) }
        setStore(MED_STORE, meds)
      }
    }

    return { record }
  }

  // ---------- Reminders ----------
  if (endpoint === '/reminders' && method === 'GET') {
    const fid = getActiveFamilyId()
    if (!fid) return { reminders: [] }
    const items = getStore(REM_STORE, []).filter((r: any) => r.familyId === fid)
    return { reminders: items }
  }

  if (endpoint.startsWith('/reminders/') && method === 'PUT') {
    const id = endpoint.split('/')[2]
    const items = getStore(REM_STORE, [])
    const idx = items.findIndex((r: any) => r.id === id)
    if (idx < 0) throw new Error('提醒不存在')
    items[idx] = { ...items[idx], ...body }
    setStore(REM_STORE, items)
    return { reminder: items[idx] }
  }

  if (endpoint.startsWith('/reminders/') && method === 'DELETE') {
    const id = endpoint.split('/')[2]
    const items = getStore(REM_STORE, []).filter((r: any) => r.id !== id)
    setStore(REM_STORE, items)
    return { success: true }
  }

  return {}
}

// ---------- 导出 ----------
export const api = {
  enableDemo,
  isDemo,
  seedDemoIfEmpty,
  getActiveFamilyId,

  auth: {
    register: (email: string, password: string, name: string) =>
      request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
    login: (email: string, password: string) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me: () => request('/auth/me')
  },

  family: {
    get: () => request('/family/my'),
    getMembers: () => request('/family/members'),
    create: (name: string) => request('/family/create', { method: 'POST', body: JSON.stringify({ name }) }),
    join: (code: string) => request('/family/join', { method: 'POST', body: JSON.stringify({ code }) }),
    leave: () => request('/family/leave', { method: 'POST', body: JSON.stringify({}) }),
    rename: (name: string) => request('/family/rename', { method: 'PUT', body: JSON.stringify({ name }) }),
    regenerateCode: () => request('/family/regenerate-code', { method: 'POST', body: JSON.stringify({}) }),
    removeMember: (userId: string) => request(`/family/members/${userId}`, { method: 'DELETE' })
  },

  medicines: {
    list: () => request('/medicines'),
    create: (data: any) => request('/medicines', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request(`/medicines/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/medicines/${id}`, { method: 'DELETE' })
  },

  records: {
    list: (_params?: any) => request('/records'),
    create: (data: { medicineId: string; takenAt: string; status: string }) =>
      request('/records', { method: 'POST', body: JSON.stringify(data) })
  },

  reminders: {
    list: () => request('/reminders'),
    update: (id: string, data: { enabled?: boolean; times?: string[] }) =>
      request(`/reminders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/reminders/${id}`, { method: 'DELETE' })
  }
}
