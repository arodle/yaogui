import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Camera, Minus, PackagePlus, Plus, Trash2, Upload, X } from 'lucide-react'
import { api } from '../api'
import { buildCategoryOptions, DEFAULT_MEDICINE_CATEGORIES } from '../constants/medicineCategories'
import { buildDiseaseOptions, DEFAULT_DISEASE_CATEGORIES } from '../constants/diseaseCategories'
import { uploadImageToOss } from '../utils/imageUpload'

const units = ['片', '粒', '颗', '瓶', '盒', '支', '袋', '包', 'ml', 'g']

export function AddMedicine() {
  const navigate = useNavigate()
  const { id: medicineId } = useParams()
  const isEditing = Boolean(medicineId)

  const [loading, setLoading] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [availableCategoryValues, setAvailableCategoryValues] = useState<string[]>([])
  const [availableDiseaseValues, setAvailableDiseaseValues] = useState<string[]>([])
  const [customCategory, setCustomCategory] = useState('')
  const [customDiseaseCategory, setCustomDiseaseCategory] = useState('')
  const [form, setForm] = useState({
    name: '',
    category: 'western',
    diseaseCategory: 'other',
    quantity: '',
    unit: '片',
    expiryDate: '',
    threshold: '10'
  })
  const [reminderTimes, setReminderTimes] = useState<string[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const categoryOptions = useMemo(
    () => buildCategoryOptions(availableCategoryValues),
    [availableCategoryValues]
  )
  const diseaseOptions = useMemo(
    () => buildDiseaseOptions(availableDiseaseValues),
    [availableDiseaseValues]
  )
  const isCustomCategory = useMemo(
    () => !DEFAULT_MEDICINE_CATEGORIES.some((item) => item.value === form.category),
    [form.category]
  )
  const isCustomDiseaseCategory = useMemo(
    () => !DEFAULT_DISEASE_CATEGORIES.some((item) => item.value === form.diseaseCategory),
    [form.diseaseCategory]
  )

  useEffect(() => {
    const loadData = async () => {
      try {
        const [medicinesRes, remindersRes] = await Promise.all([
          api.medicines.list(),
          api.reminders.list().catch(() => ({ reminders: [] }))
        ])

        const medicines = medicinesRes.medicines || []
        setAvailableCategoryValues(medicines.map((medicine: any) => medicine.category).filter(Boolean))
        setAvailableDiseaseValues(medicines.map((medicine: any) => medicine.diseaseCategory).filter(Boolean))

        if (medicineId) {
          const medicine = medicines.find((item: any) => item.id === medicineId)
          if (!medicine) {
            setError('药品不存在')
            return
          }

          setForm({
            name: medicine.name || '',
            category: medicine.category || 'western',
            diseaseCategory: medicine.diseaseCategory || 'other',
            quantity: String(medicine.quantity ?? ''),
            unit: medicine.unit || '片',
            expiryDate: medicine.expiryDate ? String(medicine.expiryDate).slice(0, 10) : '',
            threshold: String(medicine.threshold ?? 10)
          })
          setPhoto(medicine.photo || null)

          const reminder = (remindersRes.reminders || []).find((item: any) => item.medicineId === medicineId)
          if (reminder?.times?.length) {
            setReminderTimes(reminder.times)
          } else {
            setReminderTimes([])
          }
        } else {
          try {
            const pending = sessionStorage.getItem('pendingPhoto')
            if (pending) {
              setPhoto(pending)
              sessionStorage.removeItem('pendingPhoto')
            }
          } catch {
            // ignore session storage errors
          }
        }
      } catch (err: any) {
        setError(err.message || '加载药品失败')
      } finally {
        setInitialLoading(false)
      }
    }

    loadData()
  }, [medicineId])

  useEffect(() => {
    if (isCustomCategory) {
      setCustomCategory(form.category)
    } else {
      setCustomCategory('')
    }
  }, [form.category, isCustomCategory])

  useEffect(() => {
    if (isCustomDiseaseCategory) {
      setCustomDiseaseCategory(form.diseaseCategory)
    } else {
      setCustomDiseaseCategory('')
    }
  }, [form.diseaseCategory, isCustomDiseaseCategory])

  const readFile = async (file: File) => {
    setError('')
    setPhotoUploading(true)
    try {
      const photoUrl = await uploadImageToOss(file, 'medicine-photos')
      setPhoto(photoUrl || null)
    } catch (err: any) {
      setError(err.message || '上传药品照片失败')
    } finally {
      setPhotoUploading(false)
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void readFile(file)
    event.target.value = ''
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload = {
        name: form.name,
        category: customCategory.trim() || form.category,
        diseaseCategory: customDiseaseCategory.trim() || form.diseaseCategory,
        photo,
        quantity: parseInt(form.quantity, 10) || 0,
        unit: form.unit,
        expiryDate: form.expiryDate || null,
        threshold: parseInt(form.threshold, 10) || 10,
        reminderTimes: reminderTimes.filter(Boolean)
      }

      if (isEditing && medicineId) {
        await api.medicines.update(medicineId, payload)
      } else {
        await api.medicines.create(payload)
      }

      navigate('/medicines')
    } catch (err: any) {
      setError(err.message || '保存药品失败')
    } finally {
      setLoading(false)
    }
  }

  const addReminderTime = () => setReminderTimes((current) => [...current, current.length === 0 ? '08:00' : '12:00'])
  const removeReminderTime = (index: number) => setReminderTimes((current) => current.filter((_, currentIndex) => currentIndex !== index))
  const updateReminderTime = (index: number, value: string) => {
    setReminderTimes((current) => current.map((time, currentIndex) => currentIndex === index ? value : time))
  }
  const adjustQuantity = (delta: number) => {
    setForm((current) => {
      const currentQuantity = parseInt(current.quantity, 10) || 0
      return { ...current, quantity: String(Math.max(0, currentQuantity + delta)) }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/medicines')}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-500" />
        </button>
        <h1 className="text-2xl font-semibold text-text">{isEditing ? '编辑药品' : '添加药品'}</h1>
      </div>

      {initialLoading ? (
        <div className="card py-16 text-center text-gray-400">加载中...</div>
      ) : (
        <form onSubmit={handleSubmit} className="card space-y-6">
          {error && (
            <div className="bg-red-50 text-red-500 px-4 py-3 rounded-xl text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">药品照片</label>
            <div className="flex flex-col items-center gap-4">
              {photo ? (
                <div className="relative w-40 h-40 rounded-xl overflow-hidden border-2 border-primary/30 bg-gray-50">
                  <img src={photo} alt="药品照片" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    className="absolute top-1 right-1 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center text-white shadow-md"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="w-40 h-40 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 text-gray-300">
                  {photoUploading ? '上传中...' : '暂无图片'}
                </div>
              )}

              <div className="flex gap-3">
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={photoUploading}
                  className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl font-medium hover:bg-primary/20 transition-colors"
                >
                  <Camera className="w-5 h-5" />
                  拍照
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photoUploading}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary/10 text-secondary rounded-xl font-medium hover:bg-secondary/20 transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  上传照片
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">药品名称 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field"
              placeholder="请输入药品名称"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">疾病分类 *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {diseaseOptions.map((category) => (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => setForm({ ...form, diseaseCategory: category.value })}
                  className={`p-3 rounded-xl text-center transition-all ${
                    form.diseaseCategory === category.value
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="text-2xl mb-1">{category.icon}</div>
                  <div className="text-xs font-medium">{category.label}</div>
                </button>
              ))}
            </div>
            <input
              type="text"
              value={customDiseaseCategory}
              onChange={(e) => {
                const value = e.target.value
                setCustomDiseaseCategory(value)
                if (value.trim()) setForm({ ...form, diseaseCategory: value.trim() })
              }}
              className="input-field mt-3"
              placeholder="或输入自定义疾病分类，比如：儿科、妇科、眼科"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">药品分类 *</label>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((category) => (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => setForm({ ...form, category: category.value })}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    form.category === category.value
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {category.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setForm({ ...form, category: customCategory.trim() || 'custom' })}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  isCustomCategory
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                自定义分类
              </button>
            </div>
            <input
              type="text"
              value={customCategory}
              onChange={(e) => {
                const value = e.target.value
                setCustomCategory(value)
                if (value.trim()) setForm({ ...form, category: value.trim() })
              }}
              className="input-field mt-3"
              placeholder="比如：儿科常备、肠胃药、护理耗材"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">数量 *</label>
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="input-field"
                placeholder="0"
                min="0"
                required
              />
              {isEditing && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => adjustQuantity(-1)}
                    className="flex items-center justify-center gap-1 rounded-xl bg-gray-100 px-2 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200"
                  >
                    <Minus className="w-4 h-4" />
                    用掉1
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustQuantity(1)}
                    className="flex items-center justify-center gap-1 rounded-xl bg-gray-100 px-2 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200"
                  >
                    <Plus className="w-4 h-4" />
                    加1
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustQuantity(10)}
                    className="flex items-center justify-center gap-1 rounded-xl bg-primary/10 px-2 py-2 text-sm font-medium text-primary hover:bg-primary/20"
                  >
                    <PackagePlus className="w-4 h-4" />
                    补货10
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">单位</label>
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="input-field"
              >
                {units.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">有效期至</label>
              <input
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">库存预警阈值</label>
              <input
                type="number"
                value={form.threshold}
                onChange={(e) => setForm({ ...form, threshold: e.target.value })}
                className="input-field"
                min="0"
              />
            </div>
          </div>

          {isEditing ? (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">服药提醒时间（可选）</label>
              {reminderTimes.length === 0 ? (
                <p className="text-sm text-gray-400 bg-gray-50 rounded-xl p-3">
                  当前药品没有服药提醒；需要用药时再添加提醒时间。
                </p>
              ) : (
                <div className="space-y-2">
                  {reminderTimes.map((time, index) => (
                    <div key={`${time}-${index}`} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => updateReminderTime(index, e.target.value)}
                        className="input-field flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeReminderTime(index)}
                        className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={addReminderTime}
                className="mt-2 flex items-center gap-2 text-primary text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                添加提醒时间
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4">
              这是药品盘点入库，不会自动创建服药提醒。以后需要服用时，进入该药品编辑页再添加提醒时间。
            </div>
          )}

          <button
            type="submit"
            disabled={loading || photoUploading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {photoUploading ? '照片上传中...' : loading ? '保存中...' : isEditing ? '保存修改' : '保存药品'}
          </button>
        </form>
      )}
    </div>
  )
}
