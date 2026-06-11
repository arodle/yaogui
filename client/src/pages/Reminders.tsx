import { useEffect, useState } from 'react'
import { Bell, Clock, Trash2, Pill } from 'lucide-react'
import { api } from '../api'

interface Reminder {
  id: string
  medicineId: string
  medicine: { name: string; quantity: number; unit: string }
  enabled: boolean
  times: string[]
}

export function Reminders() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReminders()
  }, [])

  const loadReminders = async () => {
    try {
      const res = await api.reminders.list()
      setReminders(res.reminders || [])
    } catch (error) {
      console.error('加载提醒失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleReminder = async (id: string, enabled: boolean) => {
    try {
      await api.reminders.update(id, { enabled })
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, enabled } : r))
      )
    } catch (error) {
      console.error('更新提醒失败:', error)
    }
  }

  const deleteReminder = async (id: string) => {
    if (!confirm('确定要删除这个提醒吗？')) return
    try {
      await api.reminders.delete(id)
      setReminders((prev) => prev.filter((r) => r.id !== id))
    } catch (error) {
      console.error('删除提醒失败:', error)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-text">服药提醒</h1>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-32 animate-pulse" />
          ))}
        </div>
      ) : reminders.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>暂无服药提醒</p>
          <p className="text-sm mt-1">添加药品时可设置提醒时间</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reminders.map((reminder) => (
            <div key={reminder.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      reminder.enabled ? 'bg-primary/10' : 'bg-gray-100'
                    }`}
                  >
                    <Pill
                      className={`w-6 h-6 ${reminder.enabled ? 'text-primary' : 'text-gray-400'}`}
                    />
                  </div>
                  <div>
                    <h3 className={`font-medium ${reminder.enabled ? 'text-text' : 'text-gray-400'}`}>
                      {reminder.medicine.name}
                    </h3>
                    <p className="text-sm text-gray-400">
                      库存：{reminder.medicine.quantity} {reminder.medicine.unit}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => deleteReminder(reminder.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleReminder(reminder.id, !reminder.enabled)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      reminder.enabled ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        reminder.enabled ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className={`flex flex-wrap gap-2 ${reminder.enabled ? 'opacity-100' : 'opacity-50'}`}>
                {reminder.times.map((time, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg"
                  >
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-text">{time}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
