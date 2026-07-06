import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Clock, AlertTriangle, CheckCircle, Pill } from 'lucide-react'
import { api } from '../api'
import { useAuthStore } from '../context/AuthContext'
import { getDiseaseMeta } from '../constants/diseaseCategories'

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

interface MedicineItem {
  id: string
  name: string
  photo: string | null
  diseaseCategory: string
  quantity: number
  threshold: number
  expiryDate: string | null
  unit: string
}

export function Home() {
  const { user } = useAuthStore()
  const [todayReminders, setTodayReminders] = useState<TodayReminder[]>([])
  const [lowStockCount, setLowStockCount] = useState(0)
  const [expiringCount, setExpiringCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadData()
  }, [])

  const loadData = async () => {
    try {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const tomorrowStart = new Date(todayStart)
      tomorrowStart.setDate(tomorrowStart.getDate() + 1)
      const [medicinesRes, recordsRes, remindersRes] = await Promise.all([
        api.medicines.list({ includePhotos: false }),
        api.records.list({ startDate: todayStart.toISOString(), endDate: tomorrowStart.toISOString() }),
        api.reminders.list().catch(() => ({ reminders: [] }))
      ])

      const medicines = (medicinesRes.medicines || []) as MedicineItem[]
      const records = recordsRes.records || []
      const reminders = remindersRes.reminders || []

      setLowStockCount(medicines.filter((item) => item.quantity <= item.threshold).length)

      const now = new Date()
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      setExpiringCount(
        medicines.filter((item) => {
          if (!item.expiryDate) return false
          const expiryDate = new Date(item.expiryDate)
          return expiryDate >= now && expiryDate <= thirtyDaysLater
        }).length
      )

      const today = now.toDateString()
      const todayRecords = records.filter((record: any) => new Date(record.takenAt).toDateString() === today)
      const medicineMap = new Map(medicines.map((item) => [item.id, item]))

      const nextReminders: TodayReminder[] = reminders
        .filter((reminder: any) => reminder.enabled !== false)
        .flatMap((reminder: any) => {
          const medicine = medicineMap.get(reminder.medicineId)
          if (!medicine) return []

          return (reminder.times || []).map((time: string) => {
            const [hours, minutes] = time.split(':').map(Number)
            const taken = todayRecords.some((record: any) => {
              const takenAt = new Date(record.takenAt)
              return record.medicineId === reminder.medicineId && takenAt.getHours() === hours && takenAt.getMinutes() === minutes
            })

            return {
              id: `${reminder.id}-${time}`,
              medicineId: reminder.medicineId,
              medicineName: medicine.name,
              photo: medicine.photo,
              diseaseCategory: medicine.diseaseCategory || 'other',
              unit: medicine.unit,
              time,
              taken
            }
          })
        })
        .sort((left: TodayReminder, right: TodayReminder) => left.time.localeCompare(right.time))

      setTodayReminders(nextReminders)
    } catch (error) {
      console.error('鍔犺浇棣栭〉鏁版嵁澶辫触', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTakeMedicine = async (reminder: TodayReminder) => {
    try {
      const takenAt = new Date()
      const [hours, minutes] = reminder.time.split(':').map(Number)
      takenAt.setHours(hours, minutes, 0, 0)

      await api.records.create({
        medicineId: reminder.medicineId,
        takenAt: takenAt.toISOString(),
        status: 'taken'
      })

      setTodayReminders((current) =>
        current.map((item) => (item.id === reminder.id ? { ...item, taken: true } : item))
      )
    } catch (error) {
      console.error('璁板綍鏈嶈嵂澶辫触', error)
    }
  }

  const pendingCount = useMemo(
    () => todayReminders.filter((item) => !item.taken).length,
    [todayReminders]
  )
  const completedCount = useMemo(
    () => todayReminders.filter((item) => item.taken).length,
    [todayReminders]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">你好，{user?.name}</h1>
          <p className="text-gray-400 mt-1">
            今天是 {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>
        <Link to="/medicines/add" className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          添加药品
        </Link>
      </div>


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
              <p className="text-sm text-gray-400">库存偏低</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <Pill className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-primary">{expiringCount}</p>
              <p className="text-sm text-gray-400">30天内到期</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text">今日服药提醒</h2>
          <Link to="/reminders" className="text-sm text-primary hover:text-primary/80">
            管理提醒
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : todayReminders.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Pill className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>今天还没有服药提醒</p>
            <p className="text-sm mt-1">添加药品时填写提醒时间，首页就会显示真实提醒。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayReminders.map((reminder) => {
              const diseaseInfo = getDiseaseMeta(reminder.diseaseCategory)
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
                    {reminder.photo ? (
                      <img
                        src={reminder.photo}
                        alt={reminder.medicineName}
                        className="w-14 h-14 rounded-xl object-cover border border-gray-100"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center text-2xl">
                        {diseaseInfo.icon}
                      </div>
                    )}
                    <div>
                      <p className={`font-medium ${reminder.taken ? 'text-secondary line-through' : 'text-text'}`}>
                        {reminder.medicineName}
                      </p>
                      <p className="text-sm text-gray-400">
                        {reminder.time} · {diseaseInfo.label} · {reminder.unit}
                      </p>
                    </div>
                  </div>

                  {reminder.taken ? (
                    <span className="px-3 py-1 rounded-full bg-secondary/10 text-secondary text-sm font-medium">
                      已服用
                    </span>
                  ) : (
                    <button
                      onClick={() => handleTakeMedicine(reminder)}
                      className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      标记已服
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
