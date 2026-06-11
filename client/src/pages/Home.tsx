import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Clock, AlertTriangle, CheckCircle, Pill, Users } from 'lucide-react'
import { api } from '../api'
import { useAuthStore } from '../context/AuthContext'

interface TodayReminder {
  id: string
  medicineId: string
  medicineName: string
  photo: string | null
  diseaseCategory: string
  unit: string
  time: string
  taken: boolean
}

const diseaseLabels: Record<string, { label: string; icon: string }> = {
  respiratory: { label: '呼吸系统', icon: '🫁' },
  cardiovascular: { label: '心血管', icon: '❤️' },
  digestive: { label: '消化系统', icon: '🤢' },
  pain: { label: '疼痛/发热', icon: '🤕' },
  immunity: { label: '免疫/保健', icon: '💪' },
  allergy: { label: '过敏', icon: '🌸' },
  trauma: { label: '外伤', icon: '🩹' },
  diabetes: { label: '糖尿病', icon: '💉' },
  sleep: { label: '睡眠/神经', icon: '😴' },
  other: { label: '其他', icon: '💊' }
}

export function Home() {
  const { user } = useAuthStore()
  const [todayReminders, setTodayReminders] = useState<TodayReminder[]>([])
  const [lowStockCount, setLowStockCount] = useState(0)
  const [expiringCount, setExpiringCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [family, setFamily] = useState<any>(null)
  const [memberCount, setMemberCount] = useState(1)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [medicinesRes, recordsRes, familyRes] = await Promise.all([
        api.medicines.list(),
        api.records.list(),
        api.family.get().catch(() => ({ family: null, members: [], medicineCount: 0 }))
      ])

      if (familyRes?.family) {
        setFamily(familyRes.family)
        setMemberCount(familyRes.members?.length || 1)
      }

      const medicines = medicinesRes.medicines || []
      const today = new Date().toDateString()
      const todayRecords = (recordsRes.records || []).filter(
        (r: any) => new Date(r.takenAt).toDateString() === today
      )

      // 计算库存不足数量
      const lowStock = medicines.filter((m: any) => m.quantity <= m.threshold).length
      setLowStockCount(lowStock)

      // 计算即将过期数量（30天内）
      const now = new Date()
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      const expiring = medicines.filter((m: any) => {
        if (!m.expiryDate) return false
        const expiry = new Date(m.expiryDate)
        return expiry <= thirtyDaysLater
      }).length
      setExpiringCount(expiring)

      const reminders: TodayReminder[] = []

      medicines.forEach((m: any) => {
        const times = ['08:00', '12:00', '18:00', '21:00']
        times.forEach((time) => {
          const [hour] = time.split(':').map(Number)
          const taken = todayRecords.some(
            (r: any) => r.medicineId === m.id && new Date(r.takenAt).getHours() === hour
          )

          reminders.push({
            id: `${m.id}-${time}`,
            medicineId: m.id,
            medicineName: m.name,
            photo: m.photo || null,
            diseaseCategory: m.diseaseCategory || 'other',
            unit: m.unit,
            time,
            taken
          })
        })
      })

      reminders.sort((a, b) => a.time.localeCompare(b.time))
      setTodayReminders(reminders)
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTakeMedicine = async (reminder: TodayReminder) => {
    try {
      const now = new Date()
      const [hours, minutes] = reminder.time.split(':').map(Number)
      now.setHours(hours, minutes, 0, 0)

      await api.records.create({
        medicineId: reminder.medicineId,
        takenAt: now.toISOString(),
        status: 'taken'
      })

      setTodayReminders((prev) =>
        prev.map((r) =>
          r.id === reminder.id ? { ...r, taken: true } : r
        )
      )
    } catch (error) {
      console.error('记录服药失败:', error)
    }
  }

  const pendingCount = todayReminders.filter((r) => !r.taken).length
  const completedCount = todayReminders.filter((r) => r.taken).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">你好，{user?.name}</h1>
          <p className="text-gray-400 mt-1">今天{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</p>
        </div>
        <Link to="/medicines/add" className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          添加药品
        </Link>
      </div>

      {/* 家庭信息卡片 */}
      {family && (
        <Link
          to="/family"
          className="card flex items-center gap-4 hover:border-primary/40 transition-all cursor-pointer bg-gradient-to-r from-primary/5 to-secondary/5"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-2xl">
            🏠
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-800 text-sm">{family.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              <span className="flex items-center gap-1 inline-flex">
                <Users className="w-3 h-3" /> {memberCount} 位成员共用此药箱
              </span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono font-bold text-primary bg-white px-2 py-1 rounded-lg border border-primary/20">
              邀请码 {family.inviteCode}
            </span>
            <p className="text-[11px] text-gray-400 mt-1">点击管理家庭 →</p>
          </div>
        </Link>
      )}

      {!family && (
        <Link
          to="/family"
          className="card hover:border-primary/40 transition-all bg-gradient-to-r from-primary/5 to-secondary/5 text-center"
        >
          <p className="text-sm text-gray-700">
            💡 <span className="text-primary font-medium">与家人共享药箱</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">点击这里创建家庭或加入家人的药箱 →</p>
        </Link>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-primary to-primary/80 text-white">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-sm opacity-80">待服药品</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-secondary to-secondary/80 text-white">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-2xl font-bold">{completedCount}</p>
              <p className="text-sm opacity-80">已服药品</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-accent" />
            <div>
              <p className="text-2xl font-bold text-accent">{lowStockCount}</p>
              <p className="text-sm text-gray-400">库存不足</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <Pill className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-primary">{expiringCount}</p>
              <p className="text-sm text-gray-400">即将过期</p>
            </div>
          </div>
        </div>
      </div>

      {/* 今日服药计划 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-text mb-4">今日服药计划</h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : todayReminders.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Pill className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无服药计划</p>
            <Link to="/medicines/add" className="text-primary text-sm mt-2 inline-block">
              添加您的第一个药品
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {todayReminders.map((reminder) => {
              const diseaseInfo = diseaseLabels[reminder.diseaseCategory] || diseaseLabels.other
              return (
                <div
                  key={reminder.id}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                    reminder.taken
                      ? 'bg-secondary/10 border-secondary/30'
                      : 'bg-white border-gray-100 hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* 药品照片 */}
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100">
                      {reminder.photo ? (
                        <img
                          src={reminder.photo}
                          alt={reminder.medicineName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/10">
                          <Pill className="w-7 h-7 text-primary/50" />
                        </div>
                      )}
                      {/* 疾病分类小标签 */}
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm text-xs">
                        {diseaseInfo.icon}
                      </div>
                    </div>
                    <div>
                      <p className={`font-medium ${reminder.taken ? 'text-secondary line-through' : 'text-text'}`}>
                        {reminder.medicineName}
                      </p>
                      <p className="text-sm text-gray-400">
                        {reminder.time} · {reminder.unit}
                      </p>
                    </div>
                  </div>

                  {reminder.taken ? (
                    <div className="flex items-center gap-2 text-secondary">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">已服用</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleTakeMedicine(reminder)}
                      className="btn-secondary text-sm px-4 py-2"
                    >
                      确认服用
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}