import { useState, useEffect } from 'react'
import { useAuthStore } from '../context/AuthContext'
import { User, Mail, LogOut, Shield, Users, Copy, RefreshCw, Trash2, UserPlus, Home } from 'lucide-react'
import { api } from '../api'

interface Family {
  id: string
  name: string
  inviteCode: string
  createdBy: string
  createdAt: string
}

interface Member {
  userId: string
  familyId: string
  joinedAt: string
  name: string
}

export function Profile() {
  const { user, logout } = useAuthStore()
  const [family, setFamily] = useState<Family | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [medicineCount, setMedicineCount] = useState(0)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showFamilyEdit, setShowFamilyEdit] = useState(false)
  const [newFamilyName, setNewFamilyName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)

  useEffect(() => {
    loadFamilyInfo()
  }, [])

  const loadFamilyInfo = async () => {
    try {
      const [familyRes, membersRes, medsRes] = await Promise.all([
        api.family.get(),
        api.family.getMembers(),
        api.medicines.list()
      ])
      setFamily(familyRes.family || null)
      setMembers(membersRes.members || [])
      setMedicineCount(medsRes.medicines?.length || 0)
    } catch (error) {
      console.error('加载家庭信息失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      logout()
      window.location.href = '/login'
    }
  }

  const handleCopyCode = async () => {
    if (!family?.inviteCode) return
    try {
      await navigator.clipboard.writeText(family.inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      alert('复制失败，请手动复制')
    }
  }

  const handleRegenerateCode = async () => {
    if (!confirm('确定要重新生成邀请码吗？旧邀请码将失效')) return
    try {
      const res = await api.family.regenerateCode()
      if (res.family) {
        setFamily(res.family)
      }
    } catch (error) {
      console.error('重新生成邀请码失败:', error)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('确定要移除该成员吗？')) return
    try {
      await api.family.removeMember(userId)
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
    } catch (error) {
      console.error('移除成员失败:', error)
    }
  }

  const handleJoinFamily = async () => {
    if (!inviteCode.trim()) {
      alert('请输入邀请码')
      return
    }
    try {
      await api.family.join(inviteCode.trim().toUpperCase())
      alert('加入家庭成功')
      setInviteCode('')
      await loadFamilyInfo()
    } catch (error) {
      alert('加入失败，请检查邀请码是否正确')
    }
  }

  const handleLeaveFamily = async () => {
    if (!confirm('确定要离开这个家庭吗？离开后您将创建新的独立家庭')) return
    try {
      await api.family.leave()
      await loadFamilyInfo()
    } catch (error) {
      console.error('离开家庭失败:', error)
    }
  }

  const handleCreateFamily = async () => {
    if (!newFamilyName.trim()) {
      alert('请输入家庭名称')
      return
    }
    try {
      const res = await api.family.create(newFamilyName.trim())
      if (res.family) {
        setFamily(res.family)
        setNewFamilyName('')
        setShowFamilyEdit(false)
        await loadFamilyInfo()
      }
    } catch (error) {
      console.error('创建家庭失败:', error)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-text">我的</h1>

      {/* 用户信息 */}
      <div className="card">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
          <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center">
            <User className="w-10 h-10 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-text">{user?.name}</h2>
            <p className="text-gray-400 text-sm mt-1">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-400">姓名</p>
              <p className="font-medium text-text">{user?.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-400">邮箱</p>
              <p className="font-medium text-text">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-400">账号安全</p>
              <p className="font-medium text-text">已设置密码保护</p>
            </div>
          </div>
        </div>
      </div>

      {/* 家庭共享 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-medium text-text">家庭共享</h3>
          </div>
          {family && (
            <button
              onClick={() => {
                setNewFamilyName(family.name)
                setIsRenaming(true)
                setShowFamilyEdit(true)
              }}
              className="text-sm text-primary hover:text-primary/80"
            >
              编辑名称
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-400">加载中...</div>
        ) : family ? (
          <div className="space-y-4">
            {/* 家庭信息 */}
            <div className="p-4 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Home className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-text">{family.name}</h4>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>{members.length} 位成员</span>
                    <span>{medicineCount} 种药品</span>
                  </div>
                </div>
              </div>

              {/* 邀请码 */}
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                <div>
                  <p className="text-xs text-gray-400 mb-1">邀请码</p>
                  <p className="font-mono font-bold text-lg text-primary tracking-wider">
                    {family.inviteCode}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyCode}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="复制邀请码"
                  >
                    {copied ? (
                      <Copy className="w-4 h-4 text-secondary" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={handleRegenerateCode}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="重新生成"
                  >
                    <RefreshCw className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>

            {/* 成员列表 */}
            <div>
              <p className="text-sm text-gray-500 mb-3">家庭成员</p>
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium text-text">{member.name}</span>
                    </div>
                    {member.userId !== user?.id && (
                      <button
                        onClick={() => handleRemoveMember(member.userId)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="移除成员"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 离开家庭 */}
            <button
              onClick={handleLeaveFamily}
              className="w-full py-3 text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            >
              离开家庭
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 创建家庭 */}
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500 mb-3">创建您的家庭，邀请家人共同管理药箱</p>
              {showFamilyEdit ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newFamilyName}
                    onChange={(e) => setNewFamilyName(e.target.value)}
                    placeholder="输入家庭名称"
                    className="input-field text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (isRenaming) {
                          try {
                            const res = await api.family.rename(newFamilyName.trim())
                            if (res.family) {
                              setFamily(res.family)
                            }
                          } catch (error) {
                            console.error('修改家庭名称失败:', error)
                          }
                        } else {
                          await handleCreateFamily()
                        }
                        setNewFamilyName('')
                        setShowFamilyEdit(false)
                        setIsRenaming(false)
                      }}
                      className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium"
                    >
                      {isRenaming ? '确认修改' : '确认创建'}
                    </button>
                    <button
                      onClick={() => setShowFamilyEdit(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setShowFamilyEdit(true)
                    setNewFamilyName('')
                    setIsRenaming(false)
                  }}
                  className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  创建家庭
                </button>
              )}
            </div>

            {/* 加入家庭 */}
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="w-4 h-4 text-gray-400" />
                <p className="text-sm text-gray-500">加入已有家庭</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="输入邀请码"
                  maxLength={6}
                  className="flex-1 input-field text-sm"
                />
                <button
                  onClick={handleJoinFamily}
                  className="px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium"
                >
                  加入
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 健康统计 */}
      <div className="card">
        <h3 className="font-medium text-text mb-4">健康统计</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-secondary/10 rounded-xl text-center">
            <p className="text-2xl font-bold text-secondary">0</p>
            <p className="text-sm text-gray-500">本周服药天数</p>
          </div>
          <div className="p-4 bg-primary/10 rounded-xl text-center">
            <p className="text-2xl font-bold text-primary">0%</p>
            <p className="text-sm text-gray-500">服药依从性</p>
          </div>
        </div>
      </div>

      {/* 退出登录 */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 text-red-500 rounded-xl font-medium hover:bg-red-100 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        退出登录
      </button>
    </div>
  )
}
