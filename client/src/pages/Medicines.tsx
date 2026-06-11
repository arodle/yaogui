import { useEffect, useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Pill, Image as ImageIcon, Camera, Upload, BarChart3, X } from 'lucide-react'
import { api } from '../api'

interface Medicine {
  id: string
  name: string
  category: string
  diseaseCategory: string
  photo: string | null
  quantity: number
  unit: string
  expiryDate: string | null
  threshold: number
}

type StatDimension = 'disease' | 'category' | 'stock' | 'expiry'

const categories = [
  { value: 'all', label: '全部' },
  { value: 'western', label: '西药' },
  { value: 'chinese', label: '中药' },
  { value: 'health', label: '保健品' },
  { value: 'topical', label: '外用药' },
  { value: 'other', label: '其他' }
]

const diseaseCategories = [
  { value: 'all', label: '全部', icon: '💊' },
  { value: 'respiratory', label: '呼吸系统', icon: '🫁' },
  { value: 'cardiovascular', label: '心血管', icon: '❤️' },
  { value: 'digestive', label: '消化系统', icon: '🤢' },
  { value: 'pain', label: '疼痛/发热', icon: '🤕' },
  { value: 'immunity', label: '免疫/保健', icon: '💪' },
  { value: 'allergy', label: '过敏', icon: '🌸' },
  { value: 'trauma', label: '外伤', icon: '🩹' },
  { value: 'diabetes', label: '糖尿病', icon: '💉' },
  { value: 'sleep', label: '睡眠/神经', icon: '😴' },
  { value: 'other', label: '其他', icon: '💊' }
]

const categoryLabels: Record<string, string> = {
  western: '西药',
  chinese: '中药',
  health: '保健品',
  topical: '外用药',
  other: '其他'
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

const diseaseLabelsShort: Record<string, string> = {
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

const COLOR_PALETTE = [
  '#6366F1', // indigo
  '#EC4899', // pink
  '#F59E0B', // amber
  '#22C55E', // green
  '#06B6D4', // cyan
  '#8B5CF6', // violet
  '#F97316', // orange
  '#EF4444', // red
  '#10B981', // emerald
  '#3B82F6'  // blue
]

export function Medicines() {
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [diseaseCategory, setDiseaseCategory] = useState('all')
  const [showStats, setShowStats] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [statDimension, setStatDimension] = useState<StatDimension>('disease')
  const photoInputRef = useRef<HTMLInputElement>(null)
  const albumInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadMedicines()
  }, [])

  const loadMedicines = async () => {
    try {
      const res = await api.medicines.list()
      setMedicines(res.medicines || [])
    } catch (error) {
      console.error('加载药品失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setShowImport(false)
    const file = files[0]
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      sessionStorage.setItem('pendingPhoto', dataUrl)
      window.location.href = '/medicines/add'
    }
    reader.readAsDataURL(file)
  }

  const filteredMedicines = medicines.filter((m) => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'all' || m.category === category
    const matchesDisease = diseaseCategory === 'all' || m.diseaseCategory === diseaseCategory
    return matchesSearch && matchesCategory && matchesDisease
  })

  const stats = useMemo(() => {
    if (medicines.length === 0) return { groups: [], total: 0 }
    let groups: { key: string; count: number; items: Medicine[] }[] = []

    switch (statDimension) {
      case 'disease': {
        const map = new Map<string, Medicine[]>()
        medicines.forEach((m) => {
          const key = m.diseaseCategory || 'other'
          if (!map.has(key)) map.set(key, [])
          map.get(key)!.push(m)
        })
        groups = Array.from(map.entries())
          .map(([key, items]) => ({ key: diseaseLabelsShort[key] || key, count: items.length, items }))
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
  }, [medicines, statDimension])

  const pieSlices = useMemo(() => {
    if (stats.total === 0 || stats.groups.length === 0) return []
    let startAngle = -Math.PI / 2
    return stats.groups.map((g, i) => {
      const portion = g.count / stats.total
      const angle = portion * Math.PI * 2
      const endAngle = startAngle + angle
      const cx = 150, cy = 150, r = 120, innerR = 70
      const x1 = cx + r * Math.cos(startAngle)
      const y1 = cy + r * Math.sin(startAngle)
      const x2 = cx + r * Math.cos(endAngle)
      const y2 = cy + r * Math.sin(endAngle)
      const innerX1 = cx + innerR * Math.cos(startAngle)
      const innerY1 = cy + innerR * Math.sin(startAngle)
      const innerX2 = cx + innerR * Math.cos(endAngle)
      const innerY2 = cy + innerR * Math.sin(endAngle)
      const largeArc = angle > Math.PI ? 1 : 0

      let d: string
      if (stats.groups.length === 1) {
        d = `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} M ${cx - innerR} ${cy} A ${innerR} ${innerR} 0 1 0 ${cx + innerR} ${cy} A ${innerR} ${innerR} 0 1 0 ${cx - innerR} ${cy} Z`
      } else {
        d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${cx} ${cy} M ${cx} ${cy} L ${innerX1} ${innerY1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerX2} ${innerY2} Z`
      }

      startAngle = endAngle
      return {
        d,
        color: COLOR_PALETTE[i % COLOR_PALETTE.length],
        label: g.key,
        count: g.count,
        percentage: portion * 100
      }
    })
  }, [stats])

  const dimensionTabs: { value: StatDimension; label: string; icon: string }[] = [
    { value: 'disease', label: '疾病分类', icon: '🫁' },
    { value: 'category', label: '药品类型', icon: '💊' },
    { value: 'stock', label: '库存状态', icon: '📦' },
    { value: 'expiry', label: '有效期', icon: '⏰' }
  ]

  const totalQuantity = medicines.reduce((s, m) => s + m.quantity, 0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-blue-50">
      {/* 顶部搜索栏 */}
      <div className="sticky top-0 z-10 bg-gradient-to-b from-purple-100 via-purple-50 to-transparent pb-3 pt-2">
        <div className="relative flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索药品名称..."
              className="w-full pl-12 pr-4 py-2.5 bg-white/90 rounded-2xl shadow-sm border-0 outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            />
          </div>
          <button
            onClick={() => setShowStats(true)}
            className="p-2.5 bg-white/90 rounded-2xl shadow-sm text-gray-600 hover:text-primary transition-colors"
            title="统计"
          >
            <BarChart3 className="w-5 h-5" />
          </button>
          <Link to="/medicines/add" className="p-2.5 bg-gradient-to-r from-primary to-secondary rounded-2xl shadow-sm text-white">
            <Plus className="w-5 h-5" />
          </Link>
        </div>

        {/* 筛选标签 */}
        <div className="flex gap-2 overflow-x-auto pb-1 px-1">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                category === cat.value
                  ? 'bg-white text-primary shadow'
                  : 'bg-white/60 text-gray-500'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 px-1 mt-2">
          {diseaseCategories.slice(0, 6).map((cat) => (
            <button
              key={cat.value}
              onClick={() => setDiseaseCategory(cat.value)}
              className={`flex items-center gap-1 flex-shrink-0 px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                diseaseCategory === cat.value
                  ? 'bg-white text-primary shadow'
                  : 'bg-white/60 text-gray-500'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 主体：药品图片 3 列网格 */}
      <div className="px-3 pb-28">
        {loading ? (
          <div className="grid grid-cols-3 gap-2.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <div key={i} className="aspect-square rounded-2xl bg-gray-200 animate-pulse" />
            ))}
          </div>
        ) : filteredMedicines.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-10 h-10 text-gray-300" />
            </div>
            <p className="text-gray-400 text-lg mb-2">暂无药品</p>
            <p className="text-gray-400 text-sm">点击下方导入药库添加</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {filteredMedicines.map((medicine) => {
              const diseaseInfo = diseaseLabels[medicine.diseaseCategory] || diseaseLabels.other
              return (
                <Link
                  key={medicine.id}
                  to={`/medicines/${medicine.id}`}
                  className="group relative aspect-square rounded-2xl overflow-hidden shadow-sm bg-white hover:shadow-lg transition-all hover:-translate-y-0.5"
                >
                  {medicine.photo ? (
                    <img
                      src={medicine.photo}
                      alt={medicine.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                      <Pill className="w-8 h-8 text-gray-300" />
                    </div>
                  )}

                  {/* 遮罩层 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />

                  {/* 数量/库存标签 */}
                  {medicine.quantity <= medicine.threshold && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-red-500 rounded-lg text-white text-xs font-medium">
                      低库存
                    </div>
                  )}

                  {/* 底部名称 */}
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-white font-semibold text-sm truncate">{medicine.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-white/90 text-xs">{medicine.quantity} {medicine.unit}</p>
                      <span className="text-white/70 text-xs">{diseaseInfo.icon}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* 底部导入药库按钮 */}
      <div className="fixed bottom-20 left-0 right-0 px-4 z-10">
        <button
          onClick={() => setShowImport(true)}
          className="w-full py-4 bg-white rounded-2xl shadow-lg text-gray-700 font-semibold text-sm flex items-center justify-center gap-2 border border-gray-100 active:bg-gray-50"
        >
          <Upload className="w-5 h-5 text-primary" />
          导入药库
        </button>
      </div>

      {/* 导入弹窗 */}
      {showImport && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setShowImport(false)}>
          <div
            className="w-full bg-white rounded-t-3xl p-6 pb-10 animate-[slideUp_0.25s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
            <h3 className="text-lg font-bold text-gray-800 text-center mb-6">导入药库</h3>
            <div className="grid grid-cols-4 gap-4">
              <button
                onClick={() => photoInputRef.current?.click()}
                className="flex flex-col items-center p-4 rounded-2xl bg-purple-50 active:bg-purple-100 transition-colors"
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-2">
                  <Camera className="w-7 h-7 text-primary" />
                </div>
                <span className="text-sm font-medium text-gray-700">拍照</span>
              </button>
              <button
                onClick={() => albumInputRef.current?.click()}
                className="flex flex-col items-center p-4 rounded-2xl bg-blue-50 active:bg-blue-100 transition-colors"
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-2">
                  <ImageIcon className="w-7 h-7 text-secondary" />
                </div>
                <span className="text-sm font-medium text-gray-700">相册</span>
              </button>
              <button
                onClick={() => {
                  setShowImport(false)
                  window.location.href = 'taobao://trade.taobao.com/trade/itemlist/list_bought_items.htm'
                  setTimeout(() => {
                    window.location.href = 'https://trade.taobao.com/trade/itemlist/list_bought_items.htm'
                  }, 1500)
                }}
                className="flex flex-col items-center p-4 rounded-2xl bg-orange-50 active:bg-orange-100 transition-colors"
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-2">
                  <span className="text-2xl">🛍️</span>
                </div>
                <span className="text-sm font-medium text-gray-700">淘宝</span>
              </button>
              <button
                onClick={() => {
                  setShowImport(false)
                  window.location.href = 'openapp.jdmobile://virtual?params={%22category%22:%22jump%22,%22des%22:%22orderList%22}'
                  setTimeout(() => {
                    window.location.href = 'https://order.jd.com/center/list.action'
                  }, 1500)
                }}
                className="flex flex-col items-center p-4 rounded-2xl bg-red-50 active:bg-red-100 transition-colors"
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-2">
                  <span className="text-2xl">📦</span>
                </div>
                <span className="text-sm font-medium text-gray-700">京东</span>
              </button>
              <button
                onClick={() => {
                  setShowImport(false)
                  window.location.href = 'pinduoduo://?launch_type=10&target_page=orders'
                  setTimeout(() => {
                    window.location.href = 'https://mobile.yangkeduo.com/order.html'
                  }, 1500)
                }}
                className="flex flex-col items-center p-4 rounded-2xl bg-green-50 active:bg-green-100 transition-colors"
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-2">
                  <span className="text-2xl">🍊</span>
                </div>
                <span className="text-sm font-medium text-gray-700">拼多多</span>
              </button>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoUpload}
            />
            <input
              ref={albumInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>
        </div>
      )}

      {/* 统计弹窗 */}
      {showStats && (
        <div className="fixed inset-0 z-50 bg-gradient-to-b from-purple-100 via-pink-50 to-blue-50 overflow-y-auto">
          {/* 顶部导航 */}
          <div className="sticky top-0 z-10 bg-gradient-to-b from-purple-100/95 via-pink-50/95 to-transparent backdrop-blur-sm pt-3 pb-4 px-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setShowStats(false)}
                className="w-10 h-10 flex items-center justify-center bg-white/80 rounded-xl text-gray-600 shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-bold text-gray-800">药品统计</h2>
              <div className="w-10" />
            </div>

            {/* 顶部两个大数字卡片 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/70 backdrop-blur-md rounded-3xl p-5 text-center shadow-sm border border-white/50">
                <p className="text-gray-500 text-sm mb-1">药品总数</p>
                <p className="text-3xl font-bold text-gray-800">{medicines.length}件</p>
              </div>
              <div className="bg-white/70 backdrop-blur-md rounded-3xl p-5 text-center shadow-sm border border-white/50">
                <p className="text-gray-500 text-sm mb-1">库存总量</p>
                <p className="text-3xl font-bold text-gray-800">{totalQuantity}</p>
              </div>
            </div>
          </div>

          {/* 标签切换 */}
          <div className="px-4 mb-2">
            <div className="flex gap-6 overflow-x-auto pb-2">
              {dimensionTabs.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setStatDimension(t.value)}
                  className={`text-lg whitespace-nowrap pb-1 transition-all ${
                    statDimension === t.value
                      ? 'text-gray-900 font-bold border-b-2 border-primary'
                      : 'text-gray-400 font-medium'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 统计内容卡片 */}
          <div className="px-4 pb-10">
            {medicines.length === 0 ? (
              <div className="bg-white/70 backdrop-blur-md rounded-3xl p-10 text-center shadow-sm">
                <div className="text-5xl mb-3">📊</div>
                <p className="text-gray-500">添加药品后查看统计</p>
              </div>
            ) : (
              <>
                {/* 饼图卡片 */}
                <div className="bg-white/70 backdrop-blur-md rounded-3xl p-5 mb-4 shadow-sm">
                  <h3 className="text-xl font-bold text-gray-800 mb-6">{dimensionTabs.find((t) => t.value === statDimension)?.label}分布</h3>

                  {/* 饼图 + 引出线 */}
                  <div className="relative w-full max-w-[420px] mx-auto">
                    <svg width="100%" viewBox="0 0 420 360">
                      <defs>
                        <filter id="donutShadow" x="-10%" y="-10%" width="120%" height="120%">
                          <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.1" />
                        </filter>
                      </defs>
                      {pieSlices.map((slice, i) => {
                        const cx = 210
                        const cy = 180
                        const r = 100
                        const innerR = 65
                        const portion = slice.count / stats.total
                        const angle = portion * Math.PI * 2
                        // 计算起始角度和结束角度
                        let startAngle = -Math.PI / 2
                        for (let j = 0; j < i; j++) {
                          const p = stats.groups[j].count / stats.total
                          startAngle += p * Math.PI * 2
                        }
                        const endAngle = startAngle + angle
                        const midAngle = startAngle + angle / 2

                        // 计算弧线路径
                        const x1 = cx + r * Math.cos(startAngle)
                        const y1 = cy + r * Math.sin(startAngle)
                        const x2 = cx + r * Math.cos(endAngle)
                        const y2 = cy + r * Math.sin(endAngle)
                        const innerX1 = cx + innerR * Math.cos(startAngle)
                        const innerY1 = cy + innerR * Math.sin(startAngle)
                        const innerX2 = cx + innerR * Math.cos(endAngle)
                        const innerY2 = cy + innerR * Math.sin(endAngle)
                        const largeArc = angle > Math.PI ? 1 : 0

                        let d: string
                        if (stats.groups.length === 1) {
                          d = `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} M ${cx - innerR} ${cy} A ${innerR} ${innerR} 0 1 0 ${cx + innerR} ${cy} A ${innerR} ${innerR} 0 1 0 ${cx - innerR} ${cy} Z`
                        } else {
                          d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${cx} ${cy} M ${cx} ${cy} L ${innerX1} ${innerY1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerX2} ${innerY2} Z`
                        }

                        // 引出线计算
                        const lineStartX = cx + (r + 5) * Math.cos(midAngle)
                        const lineStartY = cy + (r + 5) * Math.sin(midAngle)
                        const isRight = Math.cos(midAngle) > 0
                        const horizontalLength = 40
                        const lineEndX = isRight ? lineStartX + horizontalLength : lineStartX - horizontalLength
                        const lineEndY = lineStartY + (midAngle > -0.8 && midAngle < 0.8 ? 0 : midAngle > Math.PI - 0.8 && midAngle < Math.PI + 0.8 ? 0 : (midAngle > 0 ? 15 : -15))

                        return (
                          <g key={i}>
                            {/* 扇形 */}
                            <path
                              d={d}
                              fill={slice.color}
                              filter="url(#donutShadow)"
                              opacity={0.95}
                            />
                            {/* 引出线 - 从饼图边缘 */}
                            {slice.count > 0 && (
                              <>
                                <line
                                  x1={lineStartX}
                                  y1={lineStartY}
                                  x2={lineEndX}
                                  y2={lineEndY}
                                  stroke={slice.color}
                                  strokeWidth="1.5"
                                  opacity={0.7}
                                />
                                {/* 文字 */}
                                <text
                                  x={isRight ? lineEndX + 5 : lineEndX - 5}
                                  y={lineEndY - 5}
                                  textAnchor={isRight ? 'start' : 'end'}
                                  fontSize="11"
                                  fontWeight="500"
                                  fill="#4B5563"
                                >
                                  {slice.label}
                                </text>
                                <text
                                  x={isRight ? lineEndX + 5 : lineEndX - 5}
                                  y={lineEndY + 12}
                                  textAnchor={isRight ? 'start' : 'end'}
                                  fontSize="20"
                                  fontWeight="700"
                                  fill={slice.color}
                                >
                                  {((slice.count / stats.total) * 100).toFixed(2)}%
                                </text>
                              </>
                            )}
                          </g>
                        )
                      })}
                      {/* 中心圆 - 白色背景 */}
                      <circle cx="210" cy="180" r="65" fill="white" />
                      <text x="210" y="170" textAnchor="middle" fontSize="14" fontWeight="600" fill="#6B7280">
                        {stats.groups.length > 0 && stats.groups[0].key}
                      </text>
                      <text x="210" y="200" textAnchor="middle" fontSize="28" fontWeight="700" fill="#1F2937">
                        {stats.groups.length > 0 && `${stats.groups[0].count}件`}
                      </text>
                    </svg>
                  </div>
                </div>

                {/* 分类详细列表 */}
                <div className="bg-white/70 backdrop-blur-md rounded-3xl p-5 shadow-sm">
                  <div className="space-y-3">
                    {stats.groups.map((g, i) => {
                      const slice = pieSlices[i]
                      const percentage = (g.count / stats.total) * 100
                      return (
                        <div key={g.key} className="flex items-center justify-between py-1.5">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-gray-800 font-medium text-base whitespace-nowrap">{g.key}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-1 max-w-[60%] justify-end">
                            <div className="h-1.5 rounded-full flex-1 max-w-[150px] bg-gray-100 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.max(percentage, 3)}%`,
                                  backgroundColor: slice?.color
                                }}
                              />
                            </div>
                            <span className="text-gray-800 font-semibold text-sm whitespace-nowrap">
                              {g.count}件
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
