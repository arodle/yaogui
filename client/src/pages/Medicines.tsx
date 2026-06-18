import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  Pill,
  Image as ImageIcon,
  Camera,
  Upload,
  BarChart3,
  X,
  Tags,
  SlidersHorizontal
} from 'lucide-react'
import { api } from '../api'
import { buildCategoryOptions, getCategoryLabel } from '../constants/medicineCategories'
import { buildDiseaseOptions, getDiseaseMeta } from '../constants/diseaseCategories'
import { PieChartSummary } from '../components/PieChartSummary'
import { uploadImageToOss } from '../utils/imageUpload'

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

const dimensionLabels: Record<StatDimension, string> = {
  disease: '按疾病分类',
  category: '按药品分类',
  stock: '按库存状态',
  expiry: '按有效期'
}

const colorPalette = ['#6366F1', '#EC4899', '#F59E0B', '#22C55E', '#06B6D4', '#8B5CF6']

export function Medicines() {
  const navigate = useNavigate()
  const photoInputRef = useRef<HTMLInputElement>(null)
  const albumInputRef = useRef<HTMLInputElement>(null)

  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [diseaseCategory, setDiseaseCategory] = useState('all')
  const [quickFilter, setQuickFilter] = useState('all')
  const [showStats, setShowStats] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [statDimension, setStatDimension] = useState<StatDimension>('disease')
  const [importUploading, setImportUploading] = useState(false)
  const [reminderMedicineIds, setReminderMedicineIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    void loadMedicines()
  }, [])

  const loadMedicines = async () => {
    try {
      const [res, remindersRes] = await Promise.all([
        api.medicines.list(),
        api.reminders.list().catch(() => ({ reminders: [] }))
      ])
      setMedicines(res.medicines || [])
      setReminderMedicineIds(new Set((remindersRes.reminders || []).map((reminder: any) => reminder.medicineId)))
    } catch (error) {
      console.error('加载药品失败', error)
    } finally {
      setLoading(false)
    }
  }

  const openBillImport = (source?: string) => {
    setShowImport(false)
    navigate(source ? `/bill-import?source=${source}` : '/bill-import')
  }

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    setImportUploading(true)
    try {
      const photoUrl = await uploadImageToOss(file, 'medicine-photos')
      sessionStorage.setItem('pendingPhoto', photoUrl)
      setShowImport(false)
      navigate('/medicines/add')
    } catch (error) {
      alert(error instanceof Error ? error.message : '图片上传失败')
    } finally {
      setImportUploading(false)
      event.target.value = ''
    }
  }

  const filteredMedicines = useMemo(() => {
    return medicines.filter((medicine) => {
      const matchesSearch = medicine.name.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = category === 'all' || medicine.category === category
      const matchesDisease = diseaseCategory === 'all' || medicine.diseaseCategory === diseaseCategory
      const expiryDate = medicine.expiryDate ? new Date(medicine.expiryDate) : null
      const now = new Date()
      const monthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      const hasReminder = reminderMedicineIds.has(medicine.id)
      const matchesQuickFilter =
        quickFilter === 'all' ||
        (quickFilter === 'empty' && medicine.quantity <= 0) ||
        (quickFilter === 'low' && medicine.quantity > 0 && medicine.quantity <= medicine.threshold) ||
        (quickFilter === 'expiring' && !!expiryDate && expiryDate >= now && expiryDate <= monthLater) ||
        (quickFilter === 'expired' && !!expiryDate && expiryDate < now) ||
        (quickFilter === 'withPhoto' && !!medicine.photo) ||
        (quickFilter === 'noPhoto' && !medicine.photo) ||
        (quickFilter === 'withReminder' && hasReminder) ||
        (quickFilter === 'noReminder' && !hasReminder)
      return matchesSearch && matchesCategory && matchesDisease && matchesQuickFilter
    })
  }, [category, diseaseCategory, medicines, quickFilter, reminderMedicineIds, search])

  const quickFilterOptions = useMemo(() => [
    { value: 'all', label: '全部' },
    { value: 'low', label: '库存低' },
    { value: 'empty', label: '已用完' },
    { value: 'expiring', label: '快到期' },
    { value: 'expired', label: '已过期' },
    { value: 'withPhoto', label: '有照片' },
    { value: 'noPhoto', label: '无照片' },
    { value: 'withReminder', label: '有提醒' },
    { value: 'noReminder', label: '无提醒' }
  ], [])

  const categoryOptions = useMemo(
    () => [{ value: 'all', label: '全部' }, ...buildCategoryOptions(medicines.map((medicine) => medicine.category))],
    [medicines]
  )
  const diseaseOptions = useMemo(
    () => [{ value: 'all', label: '全部', icon: '📋' }, ...buildDiseaseOptions(medicines.map((medicine) => medicine.diseaseCategory))],
    [medicines]
  )

  const activeFilterCount = [category !== 'all', diseaseCategory !== 'all', quickFilter !== 'all'].filter(Boolean).length
  const activeFilterSummary = useMemo(() => {
    const labels = [
      categoryOptions.find((item) => item.value === category)?.label,
      diseaseOptions.find((item) => item.value === diseaseCategory)?.label,
      quickFilterOptions.find((item) => item.value === quickFilter)?.label
    ].filter((label, index) => label && [category, diseaseCategory, quickFilter][index] !== 'all')

    return labels.length > 0 ? labels.join(' · ') : '全部药品'
  }, [category, categoryOptions, diseaseCategory, diseaseOptions, quickFilter, quickFilterOptions])

  const stats = useMemo(() => {
    const groups = new Map<string, Medicine[]>()

    const pushGroup = (key: string, medicine: Medicine) => {
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)?.push(medicine)
    }

    if (statDimension === 'disease') {
      medicines.forEach((medicine) => pushGroup(getDiseaseMeta(medicine.diseaseCategory).label, medicine))
    } else if (statDimension === 'category') {
      medicines.forEach((medicine) => pushGroup(getCategoryLabel(medicine.category || 'other'), medicine))
    } else if (statDimension === 'stock') {
      medicines.forEach((medicine) => {
        if (medicine.quantity <= 0) pushGroup('已用完', medicine)
        else if (medicine.quantity <= medicine.threshold) pushGroup('库存偏低', medicine)
        else pushGroup('库存充足', medicine)
      })
    } else {
      const now = new Date()
      const monthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      const threeMonthLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

      medicines.forEach((medicine) => {
        if (!medicine.expiryDate) {
          pushGroup('未设置有效期', medicine)
          return
        }

        const expiryDate = new Date(medicine.expiryDate)
        if (expiryDate < now) pushGroup('已过期', medicine)
        else if (expiryDate <= monthLater) pushGroup('30天内到期', medicine)
        else if (expiryDate <= threeMonthLater) pushGroup('90天内到期', medicine)
        else pushGroup('有效期充足', medicine)
      })
    }

    return Array.from(groups.entries())
      .map(([label, items]) => ({ label, count: items.length, items }))
      .sort((left, right) => right.count - left.count)
  }, [medicines, statDimension])

  const totalQuantity = medicines.reduce((sum, medicine) => sum + medicine.quantity, 0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-blue-50">
      <div className="sticky top-0 z-10 bg-gradient-to-b from-purple-100 via-purple-50 to-transparent pb-3 pt-2">
        <div className="relative flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索药品名称..."
              className="w-full pl-12 pr-4 py-2.5 bg-white/90 rounded-2xl shadow-sm border-0 outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(true)}
            className={`relative p-2.5 rounded-2xl shadow-sm transition-colors ${
              activeFilterCount > 0 ? 'bg-primary text-white' : 'bg-white/90 text-gray-600 hover:text-primary'
            }`}
            title="筛选"
          >
            <SlidersHorizontal className="w-5 h-5" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowStats(true)}
            className="p-2.5 bg-white/90 rounded-2xl shadow-sm text-gray-600 hover:text-primary transition-colors"
            title="查看统计"
          >
            <BarChart3 className="w-5 h-5" />
          </button>
          <Link
            to="/medicines/categories"
            className="p-2.5 bg-white/90 rounded-2xl shadow-sm text-gray-600 hover:text-primary transition-colors"
            title="分类管理"
          >
            <Tags className="w-5 h-5" />
          </Link>
          <Link to="/medicines/add" className="p-2.5 bg-gradient-to-r from-primary to-secondary rounded-2xl shadow-sm text-white">
            <Plus className="w-5 h-5" />
          </Link>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-white/70 px-3 py-2 text-xs text-gray-500 shadow-sm">
          <span className="truncate">{activeFilterSummary}</span>
          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setCategory('all')
                setDiseaseCategory('all')
                setQuickFilter('all')
              }}
              className="ml-3 flex-shrink-0 text-primary"
            >
              清除
            </button>
          )}
        </div>
      </div>

      <div className="px-3 pb-28">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className="aspect-square rounded-2xl bg-gray-200 animate-pulse" />
            ))}
          </div>
        ) : filteredMedicines.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-10 h-10 text-gray-300" />
            </div>
            <p className="text-gray-400 text-lg mb-2">暂无匹配的药品</p>
            <p className="text-gray-400 text-sm">可以新增药品，或调整上面的搜索和筛选条件。</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredMedicines.map((medicine) => {
              const diseaseInfo = getDiseaseMeta(medicine.diseaseCategory)
              const isLowStock = medicine.quantity <= medicine.threshold

              return (
                <Link
                  key={medicine.id}
                  to={`/medicines/${medicine.id}`}
                  className="group relative aspect-square rounded-2xl overflow-hidden shadow-sm bg-white hover:shadow-lg transition-all hover:-translate-y-0.5"
                >
                  {medicine.photo ? (
                    <img src={medicine.photo} alt={medicine.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                      <Pill className="w-8 h-8 text-gray-300" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />

                  {isLowStock && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-red-500 rounded-lg text-white text-xs font-medium">
                      库存低
                    </div>
                  )}

                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-white font-semibold text-sm truncate">{medicine.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-white/90 text-xs">
                        {medicine.quantity} {medicine.unit}
                      </p>
                      <span className="text-white/70 text-xs">
                        {diseaseInfo.icon} {getCategoryLabel(medicine.category)}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <div className="fixed bottom-20 left-0 right-0 px-4 z-10">
        <button
          onClick={() => setShowImport(true)}
          className="w-full py-4 bg-white rounded-2xl shadow-lg text-gray-700 font-semibold text-sm flex items-center justify-center gap-2 border border-gray-100 active:bg-gray-50"
        >
          <Upload className="w-5 h-5 text-primary" />
          导入药品图片
        </button>
      </div>

      {showImport && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setShowImport(false)}>
          <div
            className="w-full bg-white rounded-t-3xl p-6 pb-10 animate-[slideUp_0.25s_ease-out]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
            <h3 className="text-lg font-bold text-gray-800 text-center mb-6">选择导入方式</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={importUploading}
                className="flex flex-col items-center p-4 rounded-2xl bg-purple-50 active:bg-purple-100 transition-colors"
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-2">
                  <Camera className="w-7 h-7 text-primary" />
                </div>
                <span className="text-sm font-medium text-gray-700">拍照</span>
              </button>
              <button
                onClick={() => albumInputRef.current?.click()}
                disabled={importUploading}
                className="flex flex-col items-center p-4 rounded-2xl bg-blue-50 active:bg-blue-100 transition-colors"
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-2">
                  <ImageIcon className="w-7 h-7 text-secondary" />
                </div>
                <span className="text-sm font-medium text-gray-700">相册</span>
              </button>
              <button
                onClick={() => openBillImport('taobao')}
                className="flex flex-col items-center p-4 rounded-2xl bg-orange-50 active:bg-orange-100 transition-colors"
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-2">
                  <span className="text-2xl">🛒</span>
                </div>
                <span className="text-sm font-medium text-gray-700">淘宝图片</span>
              </button>
              <button
                onClick={() => openBillImport('jd')}
                className="flex flex-col items-center p-4 rounded-2xl bg-red-50 active:bg-red-100 transition-colors"
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-2">
                  <span className="text-2xl">📦</span>
                </div>
                <span className="text-sm font-medium text-gray-700">京东图片</span>
              </button>
              <button
                onClick={() => openBillImport('pinduoduo')}
                className="flex flex-col items-center p-4 rounded-2xl bg-green-50 active:bg-green-100 transition-colors"
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-2">
                  <span className="text-2xl">🖼️</span>
                </div>
                <span className="text-sm font-medium text-gray-700">收藏夹图片</span>
              </button>
            </div>
            {importUploading && (
              <p className="mt-4 text-center text-sm text-gray-400">图片上传中...</p>
            )}
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

      {showFilters && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4" onClick={() => setShowFilters(false)}>
          <div
            className="mx-auto mt-16 max-w-2xl rounded-2xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">筛选药品</h2>
              <button
                onClick={() => setShowFilters(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-medium text-gray-600">药品分类</p>
                <div className="flex flex-wrap gap-2">
                  {categoryOptions.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setCategory(item.value)}
                      className={`px-3 py-2 rounded-xl text-sm font-medium ${
                        category === item.value ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-600">疾病分类</p>
                <div className="flex flex-wrap gap-2">
                  {diseaseOptions.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setDiseaseCategory(item.value)}
                      className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium ${
                        diseaseCategory === item.value ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-600">状态</p>
                <div className="flex flex-wrap gap-2">
                  {quickFilterOptions.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setQuickFilter(item.value)}
                      className={`px-3 py-2 rounded-xl text-sm font-medium ${
                        quickFilter === item.value ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => {
                  setCategory('all')
                  setDiseaseCategory('all')
                  setQuickFilter('all')
                }}
                className="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 font-medium"
              >
                重置
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="flex-1 rounded-xl bg-primary px-4 py-3 font-medium text-white"
              >
                查看 {filteredMedicines.length} 个药品
              </button>
            </div>
          </div>
        </div>
      )}

      {showStats && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 overflow-y-auto">
          <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">药品统计</h2>
              <button
                onClick={() => setShowStats(false)}
                className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-xl text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-gray-50 rounded-2xl p-4 text-center">
                <p className="text-sm text-gray-500">药品总数</p>
                <p className="text-3xl font-bold text-gray-800">{medicines.length}</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-4 text-center">
                <p className="text-sm text-gray-500">库存总量</p>
                <p className="text-3xl font-bold text-gray-800">{totalQuantity}</p>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap mb-5">
              {(Object.keys(dimensionLabels) as StatDimension[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setStatDimension(key)}
                  className={`px-3 py-2 rounded-xl text-sm ${
                    statDimension === key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {dimensionLabels[key]}
                </button>
              ))}
            </div>

            {stats.length === 0 ? (
              <div className="py-12 text-center text-gray-400">还没有可统计的药品数据。</div>
            ) : (
              <PieChartSummary
                items={stats.map((item) => ({ label: item.label, count: item.count }))}
                total={medicines.length}
                colors={colorPalette}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
