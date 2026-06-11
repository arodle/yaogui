import { useEffect, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Pill } from 'lucide-react'
import { api } from '../api'

interface Record {
  id: string
  medicineId: string
  medicine: { name: string; unit: string }
  takenAt: string
  status: string
}

export function Records() {
  const [records, setRecords] = useState<Record[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  useEffect(() => {
    loadRecords()
  }, [currentMonth])

  const loadRecords = async () => {
    try {
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)

      const res = await api.records.list({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      })

      setRecords(res.records || [])
    } catch (error) {
      console.error('加载记录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: Date[] = []

    const startPadding = firstDay.getDay()
    for (let i = startPadding - 1; i >= 0; i--) {
      const d = new Date(year, month, -i)
      days.push(d)
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i))
    }

    const endPadding = 42 - days.length
    for (let i = 1; i <= endPadding; i++) {
      days.push(new Date(year, month + 1, i))
    }

    return days
  }

  const getRecordsForDate = (date: Date) => {
    return records.filter((r) => {
      const recordDate = new Date(r.takenAt)
      return recordDate.toDateString() === date.toDateString()
    })
  }

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const days = getDaysInMonth(currentMonth)
  const selectedDateRecords = selectedDate ? getRecordsForDate(selectedDate) : []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-text">服药记录</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* 日历 */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
            <h2 className="font-medium text-text">
              {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
              <div key={d} className="text-xs font-medium text-gray-400 py-2">
                {d}
              </div>
            ))}
            {days.map((day, index) => {
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
              const isToday = day.toDateString() === new Date().toDateString()
              const isSelected = selectedDate?.toDateString() === day.toDateString()
              const dayRecords = getRecordsForDate(day)
              const hasRecords = dayRecords.length > 0

              return (
                <button
                  key={index}
                  onClick={() => setSelectedDate(day)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all ${
                    isSelected
                      ? 'bg-primary text-white'
                      : isToday
                      ? 'bg-primary/10 text-primary font-medium'
                      : isCurrentMonth
                      ? 'hover:bg-gray-50 text-text'
                      : 'text-gray-300'
                  }`}
                >
                  <span>{day.getDate()}</span>
                  {hasRecords && !isSelected && (
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary mt-0.5" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* 记录列表 */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="font-medium text-text">
              {selectedDate
                ? selectedDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
                : '选择日期查看记录'}
            </h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : selectedDateRecords.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Pill className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无服药记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDateRecords.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center">
                      <Pill className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <p className="font-medium text-text">{record.medicine.name}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(record.takenAt).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      record.status === 'taken'
                        ? 'bg-secondary/10 text-secondary'
                        : 'bg-accent/10 text-accent'
                    }`}
                  >
                    {record.status === 'taken' ? '已服用' : '漏服'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
