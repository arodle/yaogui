import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, Check, X } from 'lucide-react'
import { api } from '../api'
import { DEFAULT_MEDICINE_CATEGORIES, getCategoryLabel } from '../constants/medicineCategories'

interface Medicine {
  id: string
  category: string
}

export function CategoryManagement() {
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const defaultCategorySet = useMemo(
    () => new Set(DEFAULT_MEDICINE_CATEGORIES.map((item) => item.value)),
    []
  )

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    medicines.forEach((medicine) => {
      if (!medicine.category) return
      counts.set(medicine.category, (counts.get(medicine.category) || 0) + 1)
    })

    return Array.from(counts.entries())
      .map(([value, count]) => ({
        value,
        count,
        label: getCategoryLabel(value),
        isDefault: defaultCategorySet.has(value)
      }))
      .sort((left, right) => {
        if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1
        return right.count - left.count
      })
  }, [defaultCategorySet, medicines])

  const customCategories = categories.filter((category) => !category.isDefault)

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await api.medicines.list()
      setMedicines(res.medicines || [])
    } catch (err: any) {
      setError(err.message || '加载分类失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleRename = async () => {
    if (!editingCategory || !renameValue.trim()) return

    try {
      setSaving(true)
      setError('')
      await api.medicines.renameCategory(editingCategory, renameValue.trim())
      setEditingCategory(null)
      setRenameValue('')
      await loadData()
    } catch (err: any) {
      setError(err.message || '重命名分类失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (category: string) => {
    if (!confirm(`删除分类“${getCategoryLabel(category)}”后，药品会自动移动到“其他”，确定继续吗？`)) {
      return
    }

    try {
      setSaving(true)
      setError('')
      await api.medicines.deleteCategory(category)
      await loadData()
    } catch (err: any) {
      setError(err.message || '删除分类失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/medicines" className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-text">分类管理</h1>
          <p className="text-sm text-gray-400 mt-1">可重命名或删除自定义分类，系统默认分类仅支持查看。</p>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-500 px-4 py-3 rounded-xl text-sm">{error}</div>}

      {loading ? (
        <div className="card py-16 text-center text-gray-400">加载中...</div>
      ) : (
        <>
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">默认分类</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {categories.filter((category) => category.isDefault).map((category) => (
                <div key={category.value} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-800">{category.label}</div>
                    <div className="text-xs text-gray-400 mt-1">{category.count} 个药品</div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-white text-gray-400 border border-gray-200">系统默认</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">自定义分类</h2>
              <span className="text-xs text-gray-400">{customCategories.length} 个</span>
            </div>

            {customCategories.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                还没有自定义分类；新增或编辑药品时输入新的分类名称，就会出现在这里。
              </div>
            ) : (
              <div className="space-y-3">
                {customCategories.map((category) => (
                  <div key={category.value} className="rounded-xl border border-gray-100 px-4 py-3">
                    {editingCategory === category.value ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="input-field flex-1"
                          placeholder="输入新的分类名称"
                        />
                        <button
                          type="button"
                          onClick={handleRename}
                          disabled={saving || !renameValue.trim()}
                          className="p-2 rounded-lg bg-primary text-white disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(null)
                            setRenameValue('')
                          }}
                          className="p-2 rounded-lg bg-gray-100 text-gray-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-gray-800">{category.label}</div>
                          <div className="text-xs text-gray-400 mt-1">{category.count} 个药品</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategory(category.value)
                              setRenameValue(category.label)
                            }}
                            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(category.value)}
                            disabled={saving}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
