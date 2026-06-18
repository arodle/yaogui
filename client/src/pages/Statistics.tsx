import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { getCategoryLabel } from '../constants/medicineCategories'
import { getDiseaseLabel } from '../constants/diseaseCategories'
import { PieChartSummary } from '../components/PieChartSummary'

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

const colorPalette = ['#6366F1', '#22C55E', '#F97316', '#EC4899', '#06B6D4', '#8B5CF6']

export function Statistics() {
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [loading, setLoading] = useState(true)
  const [dimension, setDimension] = useState<StatDimension>('disease')

  useEffect(() => {
    void loadData()
  }, [])

  const loadData = async () => {
    try {
      const res = await api.medicines.list()
      setMedicines(res.medicines || [])
    } catch (error) {
      console.error('加载统计数据失败', error)
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const groups = new Map<string, Medicine[]>()

    const pushGroup = (key: string, medicine: Medicine) => {
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)?.push(medicine)
    }

    if (dimension === 'disease') {
      medicines.forEach((medicine) => pushGroup(getDiseaseLabel(medicine.diseaseCategory), medicine))
    } else if (dimension === 'category') {
      medicines.forEach((medicine) => pushGroup(getCategoryLabel(medicine.category || 'other'), medicine))
    } else if (dimension === 'stock') {
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
      .map(([label, items]) => ({ label, count: items.length }))
      .sort((left, right) => right.count - left.count)
  }, [dimension, medicines])

  const totalQuantity = medicines.reduce((sum, medicine) => sum + medicine.quantity, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">统计分析</h1>
        <p className="text-gray-400 text-sm mt-1">从疾病、分类、库存和有效期几个维度查看药箱分布。</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center">
          <p className="text-sm text-gray-500">药品总数</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{medicines.length}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500">库存总量</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{totalQuantity}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex gap-2 flex-wrap mb-4">
          <button onClick={() => setDimension('disease')} className={`px-3 py-2 rounded-xl text-sm ${dimension === 'disease' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>疾病</button>
          <button onClick={() => setDimension('category')} className={`px-3 py-2 rounded-xl text-sm ${dimension === 'category' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>分类</button>
          <button onClick={() => setDimension('stock')} className={`px-3 py-2 rounded-xl text-sm ${dimension === 'stock' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>库存</button>
          <button onClick={() => setDimension('expiry')} className={`px-3 py-2 rounded-xl text-sm ${dimension === 'expiry' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>有效期</button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400">加载中...</div>
        ) : stats.length === 0 ? (
          <div className="py-16 text-center text-gray-400">还没有药品数据可供统计。</div>
        ) : (
          <PieChartSummary
            items={stats.map((item) => ({ label: item.label, count: item.count }))}
            total={medicines.length}
            colors={colorPalette}
          />
        )}
      </div>
    </div>
  )
}

