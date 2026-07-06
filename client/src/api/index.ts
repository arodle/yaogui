const DEMO_MODE_KEY = 'medicine-cabinet-demo'
const DEMO_USER_KEY = 'medicine-cabinet-demo-user'
const DEMO_TOKEN = 'demo-token'
const API_BASE = '/api'
const FAM_STORE = 'demo-families'
const MEMBER_STORE = 'demo-members'
const MED_STORE = 'demo-medicines'
const REC_STORE = 'demo-records'
const REM_STORE = 'demo-reminders'

function canUseDemoMode() {
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

if (typeof window !== 'undefined' && !canUseDemoMode()) {
  localStorage.removeItem(DEMO_MODE_KEY)
  localStorage.removeItem(DEMO_USER_KEY)

  try {
    const auth = JSON.parse(localStorage.getItem('auth-storage') || '{}')
    if (auth.state?.token === DEMO_TOKEN) {
      localStorage.removeItem('auth-storage')
    }
  } catch {
    localStorage.removeItem('auth-storage')
  }
}

type DemoUser = { id: string; email: string; name: string }
type DemoFamily = { id: string; name: string; inviteCode: string; createdBy: string; createdAt: string }
type DemoMember = { userId: string; familyId: string; joinedAt: string; name: string; role: 'owner' | 'member' }
type DemoMedicine = {
  id: string
  familyId: string
  name: string
  category: string
  diseaseCategory: string
  photo: string | null
  quantity: number
  unit: string
  expiryDate: string | null
  threshold: number
  reminderTimes?: string[]
  createdAt: string
}
type DemoReminder = { id: string; familyId: string; medicineId: string; medicineName: string; enabled: boolean; times: string[]; createdAt: string }
type DemoRecord = {
  id: string
  familyId: string
  medicineId: string
  medicine: { name: string; unit: string }
  takenAt: string
  status: string
  takenBy: string
  createdAt: string
}

function getStore<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key)
  return raw ? JSON.parse(raw) as T : fallback
}

function setStore(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

function genId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
}

function genInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let index = 0; index < 6; index += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function getDemoUser(): DemoUser | null {
  const raw = localStorage.getItem(DEMO_USER_KEY)
  return raw ? JSON.parse(raw) : null
}

function setDemoUser(user: DemoUser) {
  localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user))
}

function getUserId() {
  return getDemoUser()?.id ?? null
}

function getFamilies() {
  return getStore<DemoFamily[]>(FAM_STORE, [])
}

function setFamilies(families: DemoFamily[]) {
  setStore(FAM_STORE, families)
}

function getMembers() {
  return getStore<DemoMember[]>(MEMBER_STORE, [])
}

function setMembers(members: DemoMember[]) {
  setStore(MEMBER_STORE, members)
}

function getFamilyById(familyId: string) {
  return getFamilies().find((family) => family.id === familyId) ?? null
}

function getFamilyMembers(familyId: string) {
  return getMembers().filter((member) => member.familyId === familyId)
}

function getMemberRole(family: DemoFamily, userId: string) {
  return family.createdBy === userId ? 'owner' : 'member'
}

function getUserFamilyId(userId: string) {
  const members = getMembers()
    .filter((member) => member.userId === userId)
    .sort((left, right) => right.joinedAt.localeCompare(left.joinedAt))
  return members[0]?.familyId ?? null
}

function upsertReminderForMedicine(medicine: DemoMedicine) {
  const reminders = getStore<DemoReminder[]>(REM_STORE, [])
  const index = reminders.findIndex((item) => item.medicineId === medicine.id)
  const times = (medicine.reminderTimes || []).filter(Boolean)

  if (times.length === 0) {
    if (index >= 0) {
      reminders.splice(index, 1)
      setStore(REM_STORE, reminders)
    }
    return
  }

  const nextReminder: DemoReminder = index >= 0
    ? {
        ...reminders[index],
        medicineName: medicine.name,
        enabled: reminders[index].enabled,
        times
      }
    : {
        id: genId('rem'),
        familyId: medicine.familyId,
        medicineId: medicine.id,
        medicineName: medicine.name,
        enabled: true,
        times,
        createdAt: new Date().toISOString()
      }

  if (index >= 0) reminders[index] = nextReminder
  else reminders.push(nextReminder)
  setStore(REM_STORE, reminders)
}

function createFamilyForUser(userId: string, userName: string, email: string) {
  const familyId = genId('fam')
  const family: DemoFamily = {
    id: familyId,
    name: `${userName || email || '我的'}药箱`,
    inviteCode: genInviteCode(),
    createdBy: userId,
    createdAt: new Date().toISOString()
  }

  setFamilies([...getFamilies(), family])
  setMembers([
    ...getMembers(),
    {
      userId,
      familyId,
      joinedAt: new Date().toISOString(),
      name: userName || email || '我',
      role: 'owner'
    }
  ])

  return familyId
}

function ensureUserHasFamily(userId: string, userName: string, email: string) {
  return getUserFamilyId(userId) ?? createFamilyForUser(userId, userName, email)
}

function getActiveFamilyId() {
  const userId = getUserId()
  return userId ? getUserFamilyId(userId) : null
}

function getAuthToken() {
  try {
    const parsed = JSON.parse(localStorage.getItem('auth-storage') || '{}')
    return parsed.state?.token || null
  } catch {
    return null
  }
}

function enableDemo() {
  if (!canUseDemoMode()) {
    throw new Error('Demo mode is only available on localhost')
  }
  localStorage.setItem(DEMO_MODE_KEY, '1')
}

function isDemo() {
  return canUseDemoMode() && localStorage.getItem(DEMO_MODE_KEY) === '1'
}

function seedDemoIfEmpty() {
  if (!isDemo()) return
  const user = getDemoUser()
  if (!user) return

  const familyId = ensureUserHasFamily(user.id, user.name, user.email)
  const existingMeds = getStore<DemoMedicine[]>(MED_STORE, []).filter((medicine) => medicine.familyId === familyId)
  if (existingMeds.length > 0) return

  const sampleMeds: DemoMedicine[] = [
    { id: genId('med'), familyId, name: '阿莫西林胶囊', category: 'western', diseaseCategory: 'respiratory', photo: null, quantity: 12, unit: '粒', expiryDate: '2026-12-31', threshold: 5, createdAt: new Date().toISOString() },
    { id: genId('med'), familyId, name: '维生素C片', category: 'health', diseaseCategory: 'immunity', photo: null, quantity: 30, unit: '片', expiryDate: '2027-06-30', threshold: 10, createdAt: new Date().toISOString() },
    { id: genId('med'), familyId, name: '板蓝根颗粒', category: 'chinese', diseaseCategory: 'respiratory', photo: null, quantity: 8, unit: '袋', expiryDate: '2026-10-15', threshold: 5, createdAt: new Date().toISOString() },
    { id: genId('med'), familyId, name: '布洛芬缓释胶囊', category: 'western', diseaseCategory: 'pain', photo: null, quantity: 20, unit: '粒', expiryDate: '2027-03-20', threshold: 5, createdAt: new Date().toISOString() },
    { id: genId('med'), familyId, name: '创可贴', category: 'topical', diseaseCategory: 'trauma', photo: null, quantity: 20, unit: '片', expiryDate: null, threshold: 10, createdAt: new Date().toISOString() }
  ]
  setStore(MED_STORE, sampleMeds)

  const reminders: DemoReminder[] = [
    { id: genId('rem'), familyId, medicineId: sampleMeds[0].id, medicineName: sampleMeds[0].name, enabled: true, times: ['08:00', '20:00'], createdAt: new Date().toISOString() },
    { id: genId('rem'), familyId, medicineId: sampleMeds[1].id, medicineName: sampleMeds[1].name, enabled: true, times: ['09:00'], createdAt: new Date().toISOString() }
  ]
  setStore(REM_STORE, reminders)

  const records: DemoRecord[] = [
    { id: genId('rec'), familyId, medicineId: sampleMeds[0].id, medicine: { name: sampleMeds[0].name, unit: sampleMeds[0].unit }, takenAt: new Date(Date.now() - 3600_000).toISOString(), status: 'taken', takenBy: user.name, createdAt: new Date().toISOString() },
    { id: genId('rec'), familyId, medicineId: sampleMeds[1].id, medicine: { name: sampleMeds[1].name, unit: sampleMeds[1].unit }, takenAt: new Date(Date.now() - 7200_000).toISOString(), status: 'taken', takenBy: user.name, createdAt: new Date().toISOString() }
  ]
  setStore(REC_STORE, records)
}

async function request(endpoint: string, options: RequestInit = {}) {
  if (isDemo()) {
    return mockRequest(endpoint, options)
  }

  const token = getAuthToken()

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  if (token) {
    ;(headers as Record<string, string>).Authorization = `Bearer ${token}`
  }

  try {
    const response = await fetch(API_BASE + endpoint, { ...options, headers })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '请求失败' }))
      throw new Error(error.error || '请求失败')
    }
    return response.json()
  } catch (error) {
    if (canUseDemoMode()) {
      if (endpoint === '/auth/login' || endpoint === '/auth/register' || endpoint === '/auth/me') {
        enableDemo()
        return mockRequest(endpoint, options)
      }

      if (!endpoint.startsWith('/auth') && !endpoint.startsWith('/family') && !endpoint.startsWith('/ocr')) {
        return mockRequest(endpoint, options)
      }
    }

    throw error
  }
}

function mockRequest(endpoint: string, options: RequestInit = {}) {
  const method = options.method || 'GET'
  const body = options.body ? JSON.parse(options.body as string) : {}
  const user = getDemoUser()
  const userId = user?.id ?? null
  const familyId = getActiveFamilyId()

  if (endpoint === '/auth/register') {
    const newUser: DemoUser = { id: genId('usr'), email: body.email, name: body.name }
    setDemoUser(newUser)

    const inviteCode = String(body.inviteCode || '').trim().toUpperCase()
    if (inviteCode) {
      const family = getFamilies().find((item) => item.inviteCode === inviteCode)
      if (!family) throw new Error('邀请码无效，请确认后重试')

      setMembers([
        ...getMembers(),
        {
          userId: newUser.id,
          familyId: family.id,
          joinedAt: new Date().toISOString(),
          name: newUser.name,
          role: 'member'
        }
      ])
    } else {
      ensureUserHasFamily(newUser.id, newUser.name, newUser.email)
    }

    return { user: newUser, token: DEMO_TOKEN }
  }

  if (endpoint === '/auth/login') {
    const existingUser = getDemoUser()
    const nextUser = existingUser || { id: genId('usr'), email: body.email, name: String(body.email || '').split('@')[0] || 'demo' }
    setDemoUser(nextUser)
    ensureUserHasFamily(nextUser.id, nextUser.name, nextUser.email)
    return { user: nextUser, token: DEMO_TOKEN }
  }

  if (endpoint === '/auth/me') {
    if (!user) throw new Error('请先登录')
    return { user, familyId }
  }

  if (!userId) throw new Error('请先登录')

  if (endpoint === '/family/my') {
    if (!familyId) return { family: null, members: [], medicineCount: 0 }
    const family = getFamilyById(familyId)
    const members = getFamilyMembers(familyId)
    const medicineCount = getStore<DemoMedicine[]>(MED_STORE, []).filter((item) => item.familyId === familyId).length
    return {
      family,
      members: members.map((member) => ({ ...member, role: family ? getMemberRole(family, member.userId) : member.role })),
      medicineCount,
      currentUserRole: family ? getMemberRole(family, userId) : 'member'
    }
  }

  if (endpoint === '/family/members') {
    const family = familyId ? getFamilyById(familyId) : null
    return {
      members: familyId
        ? getFamilyMembers(familyId).map((member) => ({ ...member, role: family ? getMemberRole(family, member.userId) : member.role }))
        : []
    }
  }

  if (endpoint === '/family/create' && method === 'POST') {
    const createdFamilyId = createFamilyForUser(userId, user?.name || '', user?.email || '')
    return { family: getFamilyById(createdFamilyId), message: '家庭创建成功' }
  }

  if (endpoint === '/family/join' && method === 'POST') {
    const code = String(body.code || '').trim().toUpperCase()
    if (!code) throw new Error('请输入邀请码')

    const family = getFamilies().find((item) => item.inviteCode === code)
    if (!family) throw new Error('邀请码无效，请确认后重试')

    const exists = getMembers().some((member) => member.userId === userId && member.familyId === family.id)
    if (exists) throw new Error('您已是该家庭成员')

    setMembers([
      ...getMembers().filter((member) => !(member.userId === userId && member.familyId === family.id)),
      { userId, familyId: family.id, joinedAt: new Date().toISOString(), name: user?.name || user?.email || '我', role: 'member' }
    ])

    return { family, message: `已成功加入「${family.name}」` }
  }

  if (endpoint === '/family/leave' && method === 'POST') {
    if (!familyId) throw new Error('您当前没有家庭')
    const currentFamily = getFamilyById(familyId)
    const familyMembers = getFamilyMembers(familyId)
    if (currentFamily?.createdBy === userId && familyMembers.length > 1) {
      throw new Error('请先转移家庭拥有者，再退出家庭')
    }
    setMembers(getMembers().filter((member) => !(member.userId === userId && member.familyId === familyId)))
    const newFamilyId = createFamilyForUser(userId, user?.name || '', user?.email || '')
    return { family: getFamilyById(newFamilyId), message: '已退出当前家庭' }
  }

  if (endpoint === '/family/rename' && method === 'PUT') {
    if (!familyId) throw new Error('您当前没有家庭')
    const families = getFamilies()
    const familyIndex = families.findIndex((family) => family.id === familyId)
    if (families[familyIndex]?.createdBy !== userId) throw new Error('只有家庭拥有者可以修改家庭名称')
    families[familyIndex] = { ...families[familyIndex], name: body.name }
    setFamilies(families)
    return { family: families[familyIndex], message: '已更新家庭名称' }
  }

  if (endpoint === '/family/regenerate-code' && method === 'POST') {
    if (!familyId) throw new Error('您当前没有家庭')
    const families = getFamilies()
    const familyIndex = families.findIndex((family) => family.id === familyId)
    if (families[familyIndex]?.createdBy !== userId) throw new Error('只有家庭拥有者可以重置邀请码')
    families[familyIndex] = { ...families[familyIndex], inviteCode: genInviteCode() }
    setFamilies(families)
    return { family: families[familyIndex], message: '邀请码已重置' }
  }

  if (endpoint === '/family/transfer-owner' && method === 'POST') {
    if (!familyId) throw new Error('您当前没有家庭')
    const targetUserId = String(body.userId || '')
    if (!targetUserId) throw new Error('请选择新的家庭拥有者')

    const families = getFamilies()
    const familyIndex = families.findIndex((family) => family.id === familyId)
    if (families[familyIndex]?.createdBy !== userId) throw new Error('只有家庭拥有者可以转移权限')
    if (!getFamilyMembers(familyId).some((member) => member.userId === targetUserId)) {
      throw new Error('目标成员不在当前家庭中')
    }

    families[familyIndex] = { ...families[familyIndex], createdBy: targetUserId }
    setFamilies(families)
    return { family: families[familyIndex], message: '已转移家庭拥有者' }
  }

  if (endpoint.startsWith('/family/members/') && method === 'DELETE') {
    if (!familyId) throw new Error('您当前没有家庭')
    const family = getFamilyById(familyId)
    if (family?.createdBy !== userId) throw new Error('只有家庭拥有者可以移除成员')
    const targetUserId = endpoint.split('/')[3]
    setMembers(getMembers().filter((member) => !(member.familyId === familyId && member.userId === targetUserId && member.userId !== userId)))
    return { message: '已移除成员' }
  }

  if (endpoint === '/medicines' && method === 'GET') {
    return { medicines: familyId ? getStore<DemoMedicine[]>(MED_STORE, []).filter((item) => item.familyId === familyId) : [] }
  }

  if (endpoint === '/medicines?action=categories' && method === 'GET') {
    const medicines = familyId ? getStore<DemoMedicine[]>(MED_STORE, []).filter((item) => item.familyId === familyId) : []
    return { categories: Array.from(new Set(medicines.map((medicine) => medicine.category).filter(Boolean))) }
  }

  if (endpoint === '/medicines' && method === 'POST') {
    if (!familyId) throw new Error('您当前没有家庭')
    const medicines = getStore<DemoMedicine[]>(MED_STORE, [])
    const medicine: DemoMedicine = {
      id: genId('med'),
      familyId,
      name: body.name,
      category: body.category,
      diseaseCategory: body.diseaseCategory,
      photo: body.photo ?? null,
      quantity: Number(body.quantity) || 0,
      unit: body.unit || '盒',
      expiryDate: body.expiryDate ?? null,
      threshold: Number(body.threshold) || 0,
      reminderTimes: body.reminderTimes || [],
      createdAt: new Date().toISOString()
    }
    medicines.push(medicine)
    setStore(MED_STORE, medicines)
    upsertReminderForMedicine(medicine)
    return { medicine }
  }

  if (endpoint.startsWith('/medicines/') && method === 'PUT') {
    const medicineId = endpoint.split('/')[2]
    const medicines = getStore<DemoMedicine[]>(MED_STORE, [])
    const index = medicines.findIndex((item) => item.id === medicineId)
    if (index < 0) throw new Error('药品不存在')
    medicines[index] = { ...medicines[index], ...body }
    setStore(MED_STORE, medicines)
    upsertReminderForMedicine(medicines[index])
    return { medicine: medicines[index] }
  }

  if (endpoint === '/medicines?action=rename-category' && method === 'PUT') {
    if (!familyId) throw new Error('您当前没有家庭')
    const medicines = getStore<DemoMedicine[]>(MED_STORE, [])
    const updated = medicines.map((medicine) =>
      medicine.familyId === familyId && medicine.category === body.fromCategory
        ? { ...medicine, category: body.toCategory }
        : medicine
    )
    setStore(MED_STORE, updated)
    return { success: true }
  }

  if (endpoint.startsWith('/medicines/') && method === 'DELETE') {
    const medicineId = endpoint.split('/')[2]
    setStore(MED_STORE, getStore<DemoMedicine[]>(MED_STORE, []).filter((item) => item.id !== medicineId))
    setStore(REM_STORE, getStore<DemoReminder[]>(REM_STORE, []).filter((item) => item.medicineId !== medicineId))
    return { success: true }
  }

  if (endpoint.startsWith('/medicines?action=delete-category') && method === 'DELETE') {
    if (!familyId) throw new Error('您当前没有家庭')
    const url = new URL(`http://local${endpoint}`)
    const category = url.searchParams.get('category')
    const medicines = getStore<DemoMedicine[]>(MED_STORE, [])
    const updated = medicines.map((medicine) =>
      medicine.familyId === familyId && medicine.category === category
        ? { ...medicine, category: 'other' }
        : medicine
    )
    setStore(MED_STORE, updated)
    return { success: true }
  }

  if (endpoint === '/records' && method === 'GET') {
    return { records: familyId ? getStore<DemoRecord[]>(REC_STORE, []).filter((item) => item.familyId === familyId) : [] }
  }

  if (endpoint === '/records' && method === 'POST') {
    if (!familyId) throw new Error('您当前没有家庭')
    const medicines = getStore<DemoMedicine[]>(MED_STORE, [])
    const medicine = medicines.find((item) => item.id === body.medicineId)
    if (!medicine) throw new Error('药品不存在')
    const record: DemoRecord = {
      id: genId('rec'),
      familyId,
      medicineId: body.medicineId,
      medicine: { name: medicine.name, unit: medicine.unit },
      takenAt: body.takenAt,
      status: body.status,
      takenBy: user?.name || '我',
      createdAt: new Date().toISOString()
    }
    const records = getStore<DemoRecord[]>(REC_STORE, [])
    records.push(record)
    setStore(REC_STORE, records)
    return { record }
  }

  if (endpoint === '/reminders' && method === 'GET') {
    const medicines = getStore<DemoMedicine[]>(MED_STORE, [])
    const reminders = familyId ? getStore<DemoReminder[]>(REM_STORE, []).filter((item) => item.familyId === familyId) : []
    return {
      reminders: reminders.map((item) => {
        const medicine = medicines.find((entry) => entry.id === item.medicineId)
        return {
          ...item,
          medicine: medicine
            ? { name: medicine.name, quantity: medicine.quantity, unit: medicine.unit }
            : { name: item.medicineName, quantity: 0, unit: '' }
        }
      })
    }
  }

  if (endpoint.startsWith('/reminders/') && method === 'PUT') {
    const reminderId = endpoint.split('/')[2]
    const reminders = getStore<DemoReminder[]>(REM_STORE, [])
    const index = reminders.findIndex((item) => item.id === reminderId)
    if (index < 0) throw new Error('提醒不存在')
    reminders[index] = { ...reminders[index], ...body }
    setStore(REM_STORE, reminders)
    return { reminder: reminders[index] }
  }

  if (endpoint.startsWith('/reminders/') && method === 'DELETE') {
    const reminderId = endpoint.split('/')[2]
    setStore(REM_STORE, getStore<DemoReminder[]>(REM_STORE, []).filter((item) => item.id !== reminderId))
    return { success: true }
  }

  return {}
}

export const api = {
  enableDemo,
  isDemo,
  seedDemoIfEmpty,
  getActiveFamilyId,
  auth: {
    register: (email: string, password: string, name: string, inviteCode?: string) =>
      request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name, inviteCode }) }),
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
    transferOwner: (userId: string) => request('/family/transfer-owner', { method: 'POST', body: JSON.stringify({ userId }) }),
    removeMember: (userId: string) => request(`/family/members/${userId}`, { method: 'DELETE' })
  },
  medicines: {
    list: () => request('/medicines'),
    listCategories: () => request('/medicines?action=categories'),
    renameCategory: (fromCategory: string, toCategory: string) =>
      request('/medicines?action=rename-category', { method: 'PUT', body: JSON.stringify({ fromCategory, toCategory }) }),
    deleteCategory: (category: string) =>
      request(`/medicines?action=delete-category&category=${encodeURIComponent(category)}`, { method: 'DELETE' }),
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
  },
  uploads: {
    createPolicy: (data: { fileName?: string; contentType?: string; directory?: string }) =>
      request('/uploads', { method: 'POST', body: JSON.stringify(data) })
  },
  ocr: {
    parseImage: (data: { imageDataUrl?: string; imageUrl?: string; billText?: string; platform?: string }) =>
      request('/ocr', { method: 'POST', body: JSON.stringify(data) })
  },
  getAuthToken
}
