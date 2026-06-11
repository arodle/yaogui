import { useEffect, useState, useMemo } from 'react'
import { api } from '../api'

interface Medicine {
  id: string
  name: string
  category: string
  diseaseCategory: string
  quantity: number
  unit: string
  expiryDate: string | null
  threshold: number
  photo: string | null
}

type StatDimension = 'disease' | 'category' | 'stock' | 'expiry'

const diseaseLabels: Record<string, string> = {
  respiratory: '呼吸系统',
  cardiovascular: '心血管',
  digestive: '消化系统',
  pain: '疼痛/发热',
  immunity: '免疫/保健',
  allergy: '过敏',
  trauma: '外伤',
  diabetes: '糖尿病',
  sleep: '睡眠/神经',
  other: '其他'
}

const categoryLabels: Record<string, string> = {
  western: '西药',
  chinese: '中药',
  health: '保健品',
  topical: '外用药',
  other: '其他'
}

const COLOR_PALETTE = [
  '#6366F1', // primary
  '#22C55E', // secondary
  '#F97316', // accent
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#8B5CF6', // violet
  '#F59E0B', // amber
  '#EF4444', // red
  '#10B981', // emerald
  '#3B82F6'  // blue
]

export function Statistics() {
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [loading, setLoading] = useState(true)
  const [dimension, setDimension] = useState<StatDimension>('disease')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const res = await api.medicines.list()
      setMedicines(res.medicines || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    if (medicines.length === 0) return { groups: [], total: 0 }

    let groups: { key: string; count: number; items: Medicine[] }[] = []

    switch (dimension) {
      case 'disease': {
        const map = new Map<string, Medicine[]>()
        medicines.forEach((m) => {
          const key = m.diseaseCategory || 'other'
          if (!map.has(key)) map.set(key, [])
          map.get(key)!.push(m)
        })
        groups = Array.from(map.entries())
          .map(([key, items]) => ({ key: diseaseLabels[key] || key, count: items.length, items }))
          .sort((a, b) => b.count - a.count)
        break
      }
      case 'category': {
        const map = new Map<string, Medicine[]>()
        medicines.forEach((m) => {
          const key = m.category || 'other'
          if (!map.has(key)) map.set(key, [])
          map.get(key)!.push(m)
        })
        groups = Array.from(map.entries())
          .map(([key, items]) => ({ key: categoryLabels[key] || key, count: items.length, items }))
          .sort((a, b) => b.count - a.count)
        break
      }
      case 'stock': {
        const low = medicines.filter((m) => m.quantity === 0)
        const warn = medicines.filter((m) => m.quantity > 0 && m.quantity <= m.threshold)
        const healthy = medicines.filter((m) => m.quantity > m.threshold)
        groups = [
          { key: '库存充足', count: healthy.length, items: healthy },
          { key: '库存不足', count: warn.length, items: warn },
          { key: '已用完', count: low.length, items: low }
        ].filter((g) => g.count > 0)
        break
      }
      case 'expiry': {
        const now = new Date()
        const monthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        const threeMonthLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
        const expired = medicines.filter((m) => m.expiryDate && new Date(m.expiryDate) < now)
        const soon = medicines.filter((m) => m.expiryDate && new Date(m.expiryDate) >= now && new Date(m.expiryDate) <= monthLater)
        const medium = medicines.filter((m) => m.expiryDate && new Date(m.expiryDate) > monthLater && new Date(m.expiryDate) <= threeMonthLater)
        const far = medicines.filter((m) => !m.expiryDate || new Date(m.expiryDate) > threeMonthLater)
        groups = [
          { key: '已过期', count: expired.length, items: expired },
          { key: '1个月内到期', count: soon.length, items: soon },
          { key: '1-3个月到期', count: medium.length, items: medium },
          { key: '3个月以上', count: far.length, items: far }
        ].filter((g) => g.count > 0)
        break
      }
    }

    const total = groups.reduce((s, g) => s + g.count, 0)
    return { groups, total }
  }, [medicines, dimension])

  // 计算饼图 SVG
  const pieSlices = useMemo(() => {
    if (stats.total === 0 || stats.groups.length === 0) return []
    let startAngle = -Math.PI / 2
    return stats.groups.map((g, i) => {
      const portion = g.count / stats.total
      const angle = portion * Math.PI * 2
      const endAngle = startAngle + angle
      const cx = 150, cy = 150, r = 120
      const x1 = cx + r * Math.cos(startAngle)
      const y1 = cy + r * Math.sin(startAngle)
      const x2 = cx + r * Math.cos(endAngle)
      const y2 = cy + r * Math.sin(endAngle)
      const largeArc = angle > Math.PI ? 1 : 0

      // 单一类别时画整个圆
      let d: string
      if (stats.groups.length === 1) {
        d = `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
      } else {
        d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
      }

      // 标签位置（饼图外侧）
      const midAngle = startAngle + angle / 2
      const labelR = r * 0.62
      const labelX = cx + labelR * Math.cos(midAngle)
      const labelY = cy + labelR * Math.sin(midAngle)

      startAngle = endAngle
      return {
        d,
        color: COLOR_PALETTE[i % COLOR_PALETTE.length],
        label: g.key,
        count: g.count,
        percentage: portion * 100,
        labelX,
        labelY
      }
    })
  }, [stats])

  const dimensionTabs: { value: StatDimension; label: string; icon: string }[] = [
    { value: 'disease', label: '按疾病分类', icon: '🫁' },
    { value: 'category', label: '按药品类型', icon: '💊' },
    { value: 'stock', label: '按库存状态', icon: '📦' },
    { value: 'expiry', label: '按有效期', icon: '⏰' }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">数据统计</h1>
        <p className="text-gray-400 mt-1 text-sm">
          共 <span className="text-primary font-semibold">{medicines.length}</span> 个药品，总数量{' '}
          <span className="text-primary font-semibold">{medicines.reduce((s, m) => s + m.quantity, 0)}</span>{' '}
          单位
        </p>
      </div>

      {/* 维度切换 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {dimensionTabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setDimension(t.value)}
            className={`p-4 rounded-xl text-center transition-all ${
              dimension === t.value
                ? 'bg-primary text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
            }`}
          >
            <div className="text-2xl mb-1">{t.icon}</div>
            <div className="text-xs font-medium">{t.label}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card animate-pulse h-96" />
      ) : medicines.length === 0 ? (
        <div className="card text-center py-20 text-gray-400">
          <div className="text-5xl mb-3">📊</div>
          <p className="text-lg mb-2">暂无药品数据</p>
          <p className="text-sm">添加药品后即可查看分类统计</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* 饼图 */}
          <div className="lg:col-span-3 card">
            <h2 className="text-sm font-semibold text-gray-600 mb-4">
              {dimensionTabs.find((t) => t.value === dimension)?.label} — 分布图
            </h2>
            <div className="flex flex-col items-center">
              <svg width="100%" viewBox="0 0 300 300" className="max-w-[500px]">
                {/* 背景圆 */}
                <circle cx="150" cy="150" r="120" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1" />
                {pieSlices.map((slice, i) => (
                  <g key={i}>
                    <path
                      d={slice.d}
                      fill={slice.color}
                      stroke="white"
                      strokeWidth="2"
                      style={{ transition: 'all 0.3s' }}
                      opacity={0.92}
                    />
                    {slice.percentage >= 8 && (
                      <text
                        x={slice.labelX}
                        y={slice.labelY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="11"
                        fontWeight="600"
                        fill="white"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                      >
                        {slice.percentage.toFixed(0)}%
                      </text>
                    )}
                  </g>
                ))}
                {/* 中心数字 */}
                <circle cx="150" cy="150" r="60" fill="white" />
                <text x="150" y="140" textAnchor="middle" fontSize="14" fontWeight="600" fill="#6B7280">
                  药品总数
                </text>
                <text x="150" y="170" textAnchor="middle" fontSize="32" fontWeight="700" fill="#1F2937">
                  {stats.total}
                </text>
              </svg>
            </div>
          </div>

          {/* 分类列表 */}
          <div className="lg:col-span-2 card">
            <h2 className="text-sm font-semibold text-gray-600 mb-4">详细分类</h2>
            <div className="space-y-3">
              {stats.groups.map((g, i) => {
                const slice = pieSlices[i]
                const percentage = (g.count / stats.total) * 100
                return (
                  <div key={g.key} className="p-3 rounded-xl bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: slice?.color }}
                        />
                        <span className="text-sm font-medium text-gray-700">{g.key}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">
                        {g.count} 个 · {percentage.toFixed(1)}%
                      </span>
                    </div>
                    {/* 进度条 */}
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: slice?.color,
                          transition: 'width 0.5s ease'
                        }}
                      />
                    </div>
                    {/* 药品名列表 */}
                    <div className="mt-2 text-xs text-gray-400 flex flex-wrap gap-1">
                      {g.items.slice(0, 3).map((item) => (
                        <span
                          key={item.id}
                          className="inline-block bg-white px-2 py-0.5 rounded-full border border-gray-100"
                        >
                          {item.name}
                        </span>
                      ))}
                      {g.items.length > 3 && (
                        <span className="inline-block text-gray-400 px-1">+{g.items.length - 3}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 概览卡片 */}
      {!loading && medicines.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">药品总数</p>
            <p className="text-3xl font-bold text-text">{medicines.length}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">库存总量</p>
            <p className="text-3xl font-bold text-primary">
              {medicines.reduce((s, m) => s + m.quantity, 0)}
            </p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">库存不足</p>
            <p className="text-3xl font-bold text-accent">
              {medicines.filter((m) => m.quantity <= m.threshold).length}
            </p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">即将过期</p>
            <p className="text-3xl font-bold" style={{ color: '#F97316' }}>
              {
                (() => {
                  const now = new Date()
                  const monthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
                  return medicines.filter((m) => m.expiryDate && new Date(m.expiryDate) <= monthLater && new Date(m.expiryDate) >= now).length
                })()
              }
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
