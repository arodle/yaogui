import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  User,
  Mail,
  LogOut,
  Shield,
  Users,
  Copy,
  RefreshCw,
  Trash2,
  Home,
  ArrowRight
} from 'lucide-react'
import { useAuthStore } from '../context/AuthContext'
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
  role?: 'owner' | 'member'
}

export function Profile() {
  const { user, logout } = useAuthStore()
  const [family, setFamily] = useState<Family | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [medicineCount, setMedicineCount] = useState(0)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    void loadFamilyInfo()
  }, [])

  const loadFamilyInfo = async () => {
    try {
      const familyRes = await api.family.get()
      setFamily(familyRes.family || null)
      setMembers(familyRes.members || [])
      setMedicineCount(familyRes.medicineCount || 0)
    } catch (error) {
      console.error('加载个人信息失败', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    if (!confirm('确定要退出登录吗？')) return
    logout()
    window.location.href = '/login'
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
    if (!confirm('确定要重置邀请码吗？旧邀请码将失效。')) return
    try {
      const res = await api.family.regenerateCode()
      if (res.family) setFamily(res.family)
    } catch (error: any) {
      alert(error.message || '重置邀请码失败')
    }
  }

  const handleRemoveMember = async (memberUserId: string) => {
    if (!confirm('确定要移除该成员吗？')) return
    try {
      await api.family.removeMember(memberUserId)
      setMembers((current) => current.filter((member) => member.userId !== memberUserId))
    } catch (error: any) {
      alert(error.message || '移除成员失败')
    }
  }

  const handleJoinFamily = async () => {
    if (!inviteCode.trim()) {
      alert('请输入邀请码')
      return
    }

    try {
      setJoining(true)
      await api.family.join(inviteCode.trim().toUpperCase())
      setInviteCode('')
      await loadFamilyInfo()
      alert('已加入新的家庭')
    } catch (error: any) {
      alert(error.message || '加入家庭失败')
    } finally {
      setJoining(false)
    }
  }

  const handleLeaveFamily = async () => {
    if (!confirm('确定要退出当前家庭吗？')) return
    try {
      await api.family.leave()
      await loadFamilyInfo()
    } catch (error: any) {
      alert(error.message || '退出家庭失败')
    }
  }

  const isOwner = family?.createdBy === user?.id

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-text">我的</h1>

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

      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-medium text-text">家庭管理</h3>
          </div>
          <Link to="/family" className="text-sm text-primary font-medium flex items-center gap-1">
            共享管理
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="py-6 text-center text-gray-400">加载中...</div>
        ) : family ? (
          <div className="space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl bg-gray-50 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Home className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-text truncate">{family.name}</h4>
                  <p className="text-xs text-gray-400">
                    {members.length} 位成员 · {medicineCount} 个药品 · {isOwner ? '拥有者' : '成员'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-white border border-gray-100 px-3 py-2">
                <span className="text-xs text-gray-400">邀请码</span>
                <span className="font-mono font-bold text-primary tracking-wider">{family.inviteCode}</span>
                <button
                  onClick={handleCopyCode}
                  className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                  title="复制邀请码"
                >
                  <Copy className={`w-4 h-4 ${copied ? 'text-secondary' : 'text-gray-400'}`} />
                </button>
                {isOwner && (
                  <button
                    onClick={handleRegenerateCode}
                    className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                    title="重置邀请码"
                  >
                    <RefreshCw className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <div key={member.userId} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <User className="w-4 h-4 text-primary" />
                  <span className="font-medium text-text">{member.name}</span>
                  {member.role && <span className="text-xs text-gray-400">{member.role === 'owner' ? '拥有者' : '成员'}</span>}
                  {isOwner && member.userId !== user?.id && (
                    <button
                      onClick={() => handleRemoveMember(member.userId)}
                      className="text-gray-400 hover:text-red-500"
                      title="移除成员"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleLeaveFamily}
              className="text-sm text-gray-400 hover:text-red-500 transition-colors"
            >
              退出当前家庭
            </button>
          </div>
        ) : (
          <div className="text-sm text-gray-400 rounded-xl bg-gray-50 p-4">
            暂无家庭信息，请填写邀请码加入。
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 border-t border-gray-100 pt-4">
          <input
            type="text"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
            placeholder="输入邀请码加入或切换家庭"
            maxLength={8}
            className="flex-1 input-field text-sm"
          />
          <button
            onClick={handleJoinFamily}
            disabled={joining}
            className="px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {joining ? '加入中...' : '加入家庭'}
          </button>
        </div>
      </div>

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
