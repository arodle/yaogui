import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, Camera, Upload, X, Image as ImageIcon,
  Wand2, RotateCcw, Check, Eraser
} from 'lucide-react'
import { api } from '../api'

const categories = [
  { value: 'western', label: '西药' },
  { value: 'chinese', label: '中药' },
  { value: 'health', label: '保健品' },
  { value: 'topical', label: '外用药' },
  { value: 'other', label: '其他' }
]

const diseaseCategories = [
  { value: 'respiratory', label: '呼吸系统', icon: '🫁', desc: '感冒、咳嗽、哮喘等' },
  { value: 'cardiovascular', label: '心血管', icon: '❤️', desc: '高血压、心脏病等' },
  { value: 'digestive', label: '消化系统', icon: '🤢', desc: '胃痛、消化不良等' },
  { value: 'pain', label: '疼痛/发热', icon: '🤕', desc: '头痛、发烧、关节痛等' },
  { value: 'immunity', label: '免疫/保健', icon: '💪', desc: '维生素、增强免疫力' },
  { value: 'allergy', label: '过敏', icon: '🌸', desc: '过敏性鼻炎、皮肤过敏等' },
  { value: 'trauma', label: '外伤', icon: '🩹', desc: '伤口、擦伤、烧伤等' },
  { value: 'diabetes', label: '糖尿病', icon: '💉', desc: '血糖控制相关' },
  { value: 'sleep', label: '睡眠/神经', icon: '😴', desc: '失眠、焦虑等' },
  { value: 'other', label: '其他', icon: '💊', desc: '其他疾病类型' }
]

const units = ['片', '粒', '颗', '瓶', '盒', '支', '袋', '包', 'ml', 'g']

export function AddMedicine() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 照片 & 抠图状态
  const [photo, setPhoto] = useState<string | null>(null)
  const [originalPhoto, setOriginalPhoto] = useState<string | null>(null)
  const [cutoutMode, setCutoutMode] = useState<'none' | 'ai' | 'manual'>('none')
  const [cutoutThreshold, setCutoutThreshold] = useState(40)
  const [processing, setProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // 手动抠图画布
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(25)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  const [form, setForm] = useState({
    name: '',
    category: 'western',
    diseaseCategory: 'other',
    quantity: '',
    unit: '片',
    expiryDate: '',
    threshold: '10'
  })

  const [reminderTimes, setReminderTimes] = useState<string[]>(['08:00'])

  // 从药品库拍照/相册导入时自动填充照片
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('pendingPhoto')
      if (pending) {
        setPhoto(pending)
        setOriginalPhoto(pending)
        sessionStorage.removeItem('pendingPhoto')
      }
    } catch {
      // 忽略 sessionStorage 错误
    }
  }, [])

  // AI 自动抠图：采样四角颜色作为背景色，去除相似色
  const runAiCutout = (imgSrc: string, threshold: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const maxDim = 600
        let w = img.width, h = img.height
        if (w > maxDim || h > maxDim) {
          const r = Math.min(maxDim / w, maxDim / h)
          w = Math.round(w * r)
          h = Math.round(h * r)
        }

        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('无法创建画布'))

        ctx.drawImage(img, 0, 0, w, h)

        // 采样四角（每角取 5x5 区域）
        const imageData = ctx.getImageData(0, 0, w, h)
        const data = imageData.data

        const samples: [number, number, number][] = []
        const points = [
          [0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1],
          [Math.floor(w / 2), 0], [Math.floor(w / 2), h - 1],
          [0, Math.floor(h / 2)], [w - 1, Math.floor(h / 2)]
        ]
        const radius = 3
        for (const [cx, cy] of points) {
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
              const x = Math.min(w - 1, Math.max(0, cx + dx))
              const y = Math.min(h - 1, Math.max(0, cy + dy))
              const i = (y * w + x) * 4
              samples.push([data[i], data[i + 1], data[i + 2]])
            }
          }
        }
        const avgR = samples.reduce((s, p) => s + p[0], 0) / samples.length
        const avgG = samples.reduce((s, p) => s + p[1], 0) / samples.length
        const avgB = samples.reduce((s, p) => s + p[2], 0) / samples.length

        // 边缘检测 + 背景色距离：根据像素与背景色的距离决定透明度
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4
            const dr = data[i] - avgR
            const dg = data[i + 1] - avgG
            const db = data[i + 2] - avgB
            const dist = Math.sqrt(dr * dr + dg * dg + db * db)

            if (dist < threshold) {
              // 渐变过渡：距离越近越透明
              const alpha = Math.max(0, (dist / threshold) * 255)
              data[i + 3] = alpha
            }
          }
        }

        ctx.putImageData(imageData, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = imgSrc
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const src = ev.target?.result as string
        setPhoto(src)
        setOriginalPhoto(src)
        setCutoutMode('none')
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const src = ev.target?.result as string
        setPhoto(src)
        setOriginalPhoto(src)
        setCutoutMode('none')
      }
      reader.readAsDataURL(file)
    }
  }

  const removePhoto = () => {
    setPhoto(null)
    setOriginalPhoto(null)
    setCutoutMode('none')
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  // AI 自动抠图
  const triggerAiCutout = async () => {
    if (!originalPhoto) return
    setProcessing(true)
    try {
      const result = await runAiCutout(originalPhoto, cutoutThreshold)
      setPhoto(result)
      setCutoutMode('ai')
    } catch (err) {
      console.error(err)
    } finally {
      setProcessing(false)
    }
  }

  // 进入手动抠图模式
  const enterManualCutout = () => {
    if (!originalPhoto) return
    setCutoutMode('manual')
    setPhoto(originalPhoto)
    // 在下一帧初始化画布
    setTimeout(() => initManualCanvas(), 50)
  }

  const initManualCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas || !originalPhoto) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      const maxDim = 500
      let w = img.width, h = img.height
      if (w > maxDim || h > maxDim) {
        const r = Math.min(maxDim / w, maxDim / h)
        w = Math.round(w * r)
        h = Math.round(h * r)
      }
      canvas.width = w
      canvas.height = h
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
    }
    img.src = originalPhoto
  }

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    let clientX = 0, clientY = 0
    if ('touches' in e) {
      const t = e.touches[0] || e.changedTouches[0]
      clientX = t.clientX
      clientY = t.clientY
    } else {
      clientX = (e as React.MouseEvent).clientX
      clientY = (e as React.MouseEvent).clientY
    }
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const p = getCanvasPoint(e)
    if (!p) return
    setIsDrawing(true)
    lastPointRef.current = p
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing) return
    const p = getCanvasPoint(e)
    if (!p) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(p.x, p.y, brushSize / 2, 0, Math.PI * 2)
    ctx.fill()

    // 连笔，绘制从起点到当前点的粗线
    if (lastPointRef.current) {
      ctx.lineWidth = brushSize
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }
    ctx.restore()

    lastPointRef.current = p
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    lastPointRef.current = null
  }

  const confirmManualCutout = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setPhoto(canvas.toDataURL('image/png'))
    setCutoutMode('ai') // 作为完成态保留
  }

  const resetPhoto = () => {
    if (!originalPhoto) return
    setPhoto(originalPhoto)
    setCutoutMode('none')
    setProcessing(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api.medicines.create({
        name: form.name,
        category: form.category,
        diseaseCategory: form.diseaseCategory,
        photo,
        quantity: parseInt(form.quantity) || 0,
        unit: form.unit,
        expiryDate: form.expiryDate || null,
        threshold: parseInt(form.threshold) || 10,
        reminderTimes
      })

      navigate('/medicines')
    } catch (err: any) {
      setError(err.message || '添加药品失败')
    } finally {
      setLoading(false)
    }
  }

  const addReminderTime = () => {
    setReminderTimes([...reminderTimes, '12:00'])
  }

  const removeReminderTime = (index: number) => {
    setReminderTimes(reminderTimes.filter((_, i) => i !== index))
  }

  const updateReminderTime = (index: number, time: string) => {
    const updated = [...reminderTimes]
    updated[index] = time
    setReminderTimes(updated)
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
        <h1 className="text-2xl font-semibold text-text">添加药品</h1>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        {error && (
          <div className="bg-red-50 text-red-500 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* 药品照片 + 抠图 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">药品照片</label>
          <div className="flex flex-col items-center gap-4">
            {/* 照片展示区 */}
            {cutoutMode === 'manual' ? (
              <div className="relative w-full max-w-[500px] mx-auto">
                <div className="border-2 border-dashed border-primary/40 rounded-xl overflow-hidden bg-[conic-gradient(from_45deg,#f3f4f6_25%,white_25%,white_50%,#f3f4f6_50%,#f3f4f6_75%,white_75%)] bg-[length:20px_20px]">
                  <canvas
                    ref={canvasRef}
                    className="w-full max-h-[500px] touch-none cursor-crosshair block mx-auto"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <div className="mt-3 text-center text-xs text-gray-500">
                  💡 用手指或鼠标在图片上涂抹想<strong className="text-accent">删除的背景区域</strong>
                </div>
                <div className="mt-3 flex items-center justify-center gap-3">
                  <label className="text-sm text-gray-600">画笔粗细：</label>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    value={brushSize}
                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-xs text-gray-500">{brushSize}px</span>
                </div>
              </div>
            ) : photo ? (
              <div className="relative w-40 h-40 rounded-xl overflow-hidden border-2 border-primary/30 bg-[conic-gradient(from_45deg,#f3f4f6_25%,white_25%,white_50%,#f3f4f6_50%,#f3f4f6_75%,white_75%)] bg-[length:16px_16px]">
                <img src={photo} alt="药品照片" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute top-1 right-1 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center text-white shadow-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="w-40 h-40 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50">
                <ImageIcon className="w-12 h-12 text-gray-300" />
              </div>
            )}

            {/* 抠图控制区 */}
            {photo && cutoutMode !== 'manual' && (
              <div className="w-full max-w-md bg-gradient-to-br from-primary/5 to-secondary/5 rounded-xl p-4 border border-primary/10">
                <p className="text-xs text-gray-500 mb-3 text-center">🎯 智能抠图 — 去除背景，只保留药品</p>

                {/* AI 抠图区 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 whitespace-nowrap">敏感度：</span>
                    <input
                      type="range"
                      min="15"
                      max="120"
                      value={cutoutThreshold}
                      onChange={(e) => setCutoutThreshold(parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-400 w-10 text-right">{cutoutThreshold}</span>
                  </div>

                  <div className="flex gap-2 flex-wrap justify-center">
                    <button
                      type="button"
                      onClick={triggerAiCutout}
                      disabled={processing}
                      className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      <Wand2 className="w-4 h-4" />
                      {processing ? '处理中...' : 'AI 自动抠图'}
                    </button>
                    <button
                      type="button"
                      onClick={enterManualCutout}
                      className="flex items-center gap-1.5 px-4 py-2 bg-secondary text-white rounded-xl text-sm font-medium hover:bg-secondary/90 transition-colors"
                    >
                      <Eraser className="w-4 h-4" />
                      手动抠图
                    </button>
                    <button
                      type="button"
                      onClick={resetPhoto}
                      className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-600 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      还原
                    </button>
                  </div>

                  {cutoutMode === 'ai' && (
                    <div className="mt-2 text-xs text-center text-secondary font-medium">
                      ✓ 抠图完成，可继续点击「AI 自动抠图」调整效果，或还原后重新尝试
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 手动抠图确认按钮 */}
            {cutoutMode === 'manual' && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmManualCutout}
                  className="flex items-center gap-1.5 px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium"
                >
                  <Check className="w-4 h-4" />
                  完成抠图
                </button>
                <button
                  type="button"
                  onClick={() => { setCutoutMode('none'); setPhoto(originalPhoto) }}
                  className="flex items-center gap-1.5 px-5 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium"
                >
                  取消
                </button>
              </div>
            )}

            {/* 上传/拍照按钮 */}
            {cutoutMode !== 'manual' && (
              <div className="flex gap-3">
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraCapture}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
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
                  className="flex items-center gap-2 px-4 py-2 bg-secondary/10 text-secondary rounded-xl font-medium hover:bg-secondary/20 transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  上传照片
                </button>
              </div>
            )}
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

        {/* 疾病分类 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">疾病分类 *</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {diseaseCategories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setForm({ ...form, diseaseCategory: cat.value })}
                className={`p-3 rounded-xl text-center transition-all ${
                  form.diseaseCategory === cat.value
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="text-2xl mb-1">{cat.icon}</div>
                <div className="text-xs font-medium">{cat.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 药品分类 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">药品类型 *</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setForm({ ...form, category: cat.value })}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  form.category === cat.value
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
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
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">单位</label>
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="input-field"
            >
              {units.map((u) => (
                <option key={u} value={u}>{u}</option>
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

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">服药提醒时间</label>
          <div className="space-y-2">
            {reminderTimes.map((time, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => updateReminderTime(index, e.target.value)}
                  className="input-field flex-1"
                />
                {reminderTimes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeReminderTime(index)}
                    className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addReminderTime}
            className="mt-2 flex items-center gap-2 text-primary text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            添加提醒时间
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full disabled:opacity-50"
        >
          {loading ? '保存中...' : '保存药品'}
        </button>
      </form>
    </div>
  )
}
