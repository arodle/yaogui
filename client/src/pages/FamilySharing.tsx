import { useEffect, useState } from 'react'
import {
  Users, Copy, Check, RefreshCw, Pencil, X, UserPlus, LogOut,
  Trash2, Home as HomeIcon, Pill as PillIcon, AlertTriangle
} from 'lucide-react'
import { api } from '../api'
import { useAuthStore } from '../context/AuthContext'

interface Member {
  userId: string
  familyId: string
  joinedAt: string
  name: string
  role: 'owner' | 'member'
}

interface Family {
  id: string
  name: string
  inviteCode: string
  createdBy: string
  createdAt: string
}

export function FamilySharing() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [family, setFamily] = useState<Family | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [medicineCount, setMedicineCount] = useState(0)

  const [mode, setMode] = useState<'info' | 'join' | 'create'>('info')
  const [inviteCode, setInviteCode] = useState('')
  const [newFamilyName, setNewFamilyName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadFamily()
  }, [])

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 2500)
  }

  const loadFamily = async () => {
    try {
      setLoading(true)
      const data = await api.family.get()
      setFamily(data.family)
      setMembers(data.members || [])
      setMedicineCount(data.medicineCount || 0)
      if (!data.family) {
        setMode('info')
      }
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      showToast('error', '请输入邀请码')
      return
    }
    try {
      const res = await api.family.join(inviteCode.trim())
      setFamily(res.family)
      setInviteCode('')
      setMode('info')
      showToast('success', res.message || '加入成功')
      loadFamily()
    } catch (e: any) {
      showToast('error', e.message || '加入失败，请检查邀请码')
    }
  }

  const handleCreate = async () => {
    try {
      const res = await api.family.create(newFamilyName.trim() || `${user?.name || '我'}的家庭`)
      setFamily(res.family)
      setNewFamilyName('')
      setMode('info')
      showToast('success', res.message || '创建成功')
      loadFamily()
    } catch (e: any) {
      showToast('error', e.message || '创建失败')
    }
  }

  const handleRename = async () => {
    if (!nameDraft.trim()) return
    try {
      const res = await api.family.rename(nameDraft.trim())
      setFamily(res.family)
      setEditingName(false)
      showToast('success', res.message || '名称已更新')
    } catch (e: any) {
      showToast('error', e.message || '更新失败')
    }
  }

  const handleRegenerateCode = async () => {
    if (!confirm('确定要重置邀请码吗？旧邀请码将失效。')) return
    try {
      const res = await api.family.regenerateCode()
      setFamily(res.family)
      showToast('success', res.message || '邀请码已重置')
    } catch (e: any) {
      showToast('error', e.message || '重置失败')
    }
  }

  const handleCopyCode = async () => {
    if (!family?.inviteCode) return
    try {
      await navigator.clipboard.writeText(family.inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      showToast('error', '复制失败，请手动复制')
    }
  }

  const handleLeave = async () => {
    if (!confirm('确定要退出当前家庭吗？退出后将自动为您创建新的家庭药箱。')) return
    try {
      await api.family.leave()
      showToast('success', '已退出家庭')
      setTimeout(() => loadFamily(), 500)
    } catch (e: any) {
      showToast('error', e.message || '退出失败')
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('确定要移除该成员吗？')) return
    try {
      await api.family.removeMember(memberId)
      loadFamily()
      showToast('success', '已移除成员')
    } catch (e: any) {
      showToast('error', e.message || '移除失败')
    }
  }

  const isOwner = (m: Member) => m.userId === family?.createdBy
  const isMeOwner = family && user?.id === family.createdBy

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="card h-64 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 顶栏 */}
      <div>
        <h1 className="text-2xl font-semibold text-text">家庭共享</h1>
        <p className="text-gray-400 text-sm mt-1">
          与家人共用一个药箱，共同管理药品，查看彼此的服药记录
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`px-4 py-3 rounded-xl text-sm ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-100'
              : 'bg-red-50 text-red-600 border border-red-100'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* 无家庭：显示加入/创建引导 */}
      {!family && (
        <div className="grid md:grid-cols-2 gap-4">
          <div
            onClick={() => setMode('join')}
            className={`card cursor-pointer transition-all hover:border-primary/50 ${
              mode === 'join' ? 'border-primary ring-2 ring-primary/20' : ''
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <UserPlus className="w-8 h-8 text-primary" />
              </div>
              <div className="text-sm">
                <h3 className="font-semibold text-gray-800">加入已有家庭</h3>
                <p className="text-sm text-gray-400 mt-1">
                  输入家人分享的邀请码，加入他们的药箱
                </p>
              </div>
            </div>
            {mode === 'join' && (
              <div className="mt-4 space-y-3">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="请输入 6 位邀请码，例如 ABC123"
                  className="input-field text-center font-mono tracking-widest"
                  maxLength={8}
                />
                <button onClick={handleJoin} className="btn-primary w-full">
                  确认加入
                </button>
              </div>
            )}
          </div>

          <div
            onClick={() => setMode('create')}
            className={`card cursor-pointer transition-all hover:border-primary/50 ${
              mode === 'create' ? 'border-primary ring-2 ring-primary/20' : ''
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                <HomeIcon className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="font-semibold text-gray-800">创建新家庭</h3>
              <p className="text-sm text-gray-400 mt-1">
                自己创建一个家庭药箱，并邀请家人加入
              </p>
            </div>
            {mode === 'create' && (
              <div className="mt-4 space-y-3">
                <input
                  type="text"
                  value={newFamilyName}
                  onChange={(e) => setNewFamilyName(e.target.value)}
                  placeholder="家庭名称，例如「我们的小药箱」"
                  className="input-field"
                />
                <button onClick={handleCreate} className="btn-primary w-full">
                  创建家庭
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 有家庭：显示家庭信息与成员 */}
      {family && (
        <>
          {/* 家庭信息卡片 */}
          <div className="card bg-gradient-to-br from-primary/5 via-white to-secondary/5 border-primary/10">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-start gap-4 flex-1">
                <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center text-2xl font-bold shadow-md">
                  🏠
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {!editingName ? (
                      <>
                        <h2 className="text-xl font-semibold text-gray-800 truncate">{family.name}</h2>
                        {isMeOwner && (
                          <button
                            onClick={() => { setNameDraft(family.name); setEditingName(true) }}
                            className="p-1.5 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-100 transition"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          className="input-field py-1 px-2 text-lg flex-1"
                          autoFocus
                        />
                        <button onClick={handleRename} className="p-1.5 text-primary hover:bg-primary/10 rounded-lg">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingName(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {members.length} 位成员
                    </span>
                    <span className="flex items-center gap-1">
                      <PillIcon className="w-4 h-4" />
                      {medicineCount} 个药品
                    </span>
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      创建于 {new Date(family.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 邀请码区域 */}
          <div className="card border-primary/20">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                邀请家人加入
              </h3>
              <span className="text-xs text-gray-400">
                将邀请码分享给家人，他们即可加入您的家庭药箱
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-5 py-4">
                <span className="text-3xl font-mono font-bold tracking-[0.3em] text-primary">
                  {family.inviteCode}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? '已复制' : '复制邀请码'}
                </button>
                {isMeOwner && (
                  <button
                    onClick={handleRegenerateCode}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition"
                  >
                    <RefreshCw className="w-4 h-4" />
                    重置邀请码
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 成员列表 */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-500" />
              家庭成员（{members.length}）
            </h3>
            <div className="space-y-2">
              {members.map((member) => {
                const isMe = member.userId === user?.id
                const isThisOwner = isOwner(member)
                return (
                  <div
                    key={member.userId}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center text-lg font-bold shadow-sm">
                      {member.name?.charAt(0).toUpperCase() || '家'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800 text-sm">
                          {member.name} {isMe ? '(我)' : ''}
                        </span>
                        {isThisOwner && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary text-white font-medium">
                            家长
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        加入于 {new Date(member.joinedAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {isMeOwner && !isMe && (
                        <button
                          onClick={() => handleRemoveMember(member.userId)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="移除成员"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 退出家庭 */}
          {!isMeOwner && (
            <div className="card border border-red-100 bg-red-50/30">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-semibold text-red-700 text-sm flex items-center gap-2">
                    <LogOut className="w-4 h-4" />
                    退出当前家庭
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    退出家庭后，您将无法查看和管理该家庭的药品。退出后系统将自动为您创建一个新的家庭药箱。
                  </p>
                </div>
                <button
                  onClick={handleLeave}
                  className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition"
                >
                  退出家庭
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
