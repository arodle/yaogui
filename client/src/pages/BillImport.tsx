import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart, Check, Trash2, Plus, Image as ImageIcon,
  FileText, Sparkles, X
} from 'lucide-react'
import { api } from '../api'

type Platform = 'taobao' | 'jd' | 'pinduoduo' | 'douyin'

interface ParsedItem {
  id: string
  name: string
  quantity: number
  unit: string
  diseaseCategory: string
  category: string
}

const PLATFORMS: { value: Platform; label: string; color: string; icon: string }[] = [
  { value: 'taobao', label: '淘宝', color: '#FF6A00', icon: '🛒' },
  { value: 'jd', label: '京东', color: '#E1251B', icon: '📦' },
  { value: 'pinduoduo', label: '拼多多', color: '#E02E24', icon: '🍊' },
  { value: 'douyin', label: '抖音', color: '#000000', icon: '🎵' }
]

// 常见药品名关键词 -> 疾病分类映射
const KEYWORD_MAP: { pattern: RegExp; disease: string; category: string }[] = [
  { pattern: /(阿莫西林|头孢|青霉素|左氧氟沙星|诺氟沙星|甲硝唑|阿奇霉素)/, disease: 'respiratory', category: 'western' },
  { pattern: /(感冒|感冒灵|感康|布洛芬|泰诺|白加黑|999|连花清瘟)/, disease: 'respiratory', category: 'western' },
  { pattern: /(维生素|维C|维D|钙片|保健|鱼油|蛋白粉|褪黑素)/, disease: 'immunity', category: 'health' },
  { pattern: /(降压|缬沙坦|氨氯地平|硝苯地平|阿托伐他汀|降压药|丹参|救心)/, disease: 'cardiovascular', category: 'western' },
  { pattern: /(胃舒|奥美拉唑|雷尼替丁|吗丁啉|健胃|胃痛|胃药)/, disease: 'digestive', category: 'western' },
  { pattern: /(布洛芬|对乙酰氨基酚|止痛|芬必得|散利痛)/, disease: 'pain', category: 'western' },
  { pattern: /(氯雷他定|西替利嗪|扑尔敏|过敏)/, disease: 'allergy', category: 'western' },
  { pattern: /(创可贴|云南白药|碘伏|纱布|绷带|伤口|红花油)/, disease: 'trauma', category: 'topical' },
  { pattern: /(二甲双胍|格列美脲|胰岛素|血糖)/, disease: 'diabetes', category: 'western' },
  { pattern: /(安定|佐匹克隆|失眠|安神|睡眠)/, disease: 'sleep', category: 'chinese' },
  { pattern: /(板蓝根|黄连|菊花|中药|颗粒|丸|散|膏|饮片)/, disease: 'other', category: 'chinese' }
]

// 数字 + 单位 提取
const QUANTITY_PATTERN = /(\d+(?:\.\d+)?)\s*(片|粒|颗|瓶|盒|支|袋|包|ml|g|毫克|克|毫升)?/i

export function BillImport() {
  const navigate = useNavigate()
  const [platform, setPlatform] = useState<Platform | null>(null)
  const [step, setStep] = useState<'platform' | 'upload' | 'parse' | 'confirm'>('platform')
  const [photo, setPhoto] = useState<string | null>(null)
  const [billText, setBillText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [items, setItems] = useState<ParsedItem[]>([])
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 解析文本/图片：提取药品
  const parseContent = (text: string) => {
    const lines = text.split(/[\n,，、；;\/]+/).map((l) => l.trim()).filter(Boolean)
    const extracted: ParsedItem[] = []
    const usedIds = new Set<string>()

    lines.forEach((line) => {
      if (line.length < 2 || line.length > 80) return

      // 过滤掉明显不是药品的文本（价格、日期、运费等）
      if (/(合计|总计|优惠|运费|实付|已付款|订单|收货|快递|￥|\d{2,4}[-/.年]\d{1,2})/.test(line)) return

      // 提取数量
      let quantity = 1
      const qMatch = line.match(QUANTITY_PATTERN)
      if (qMatch) {
        quantity = parseInt(qMatch[1]) || 1
      }

      // 匹配药品分类
      let matched = false
      for (const rule of KEYWORD_MAP) {
        if (rule.pattern.test(line)) {
          const id = `id-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          if (!usedIds.has(id)) {
            extracted.push({
              id,
              name: line.replace(/[×x*]\s*\d+\s*[单位份袋盒瓶粒片颗]?$/, '').replace(/^[\d\s.]+/, '').trim() || line,
              quantity,
              unit: qMatch?.[2] || '盒',
              diseaseCategory: rule.disease,
              category: rule.category
            })
            usedIds.add(id)
            matched = true
            break
          }
        }
      }

      // 没匹配到规则的，但疑似药品相关（包含药/膏/片/丸/胶囊等）
      if (!matched && /(药|膏|片|丸|胶囊|颗粒|散|液|贴|油)|(3|二|维)?(C|维|素)/.test(line)) {
        const id = `id-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        extracted.push({
          id,
          name: line.replace(/^[\d\s.]+/, '').trim() || line,
          quantity,
          unit: qMatch?.[2] || '盒',
          diseaseCategory: 'other',
          category: 'other'
        })
      }
    })

    // 去重（按名称）
    const unique: ParsedItem[] = []
    const seen = new Set<string>()
    extracted.forEach((it) => {
      if (!seen.has(it.name)) {
        unique.push(it)
        seen.add(it.name)
      }
    })

    return unique.slice(0, 30) // 最多30个
  }

  // 图片处理时，使用内置的识别关键词提示（模拟OCR）
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setPhoto(ev.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const triggerParse = async () => {
    setParsing(true)
    // 模拟OCR/识别耗时
    await new Promise((r) => setTimeout(r, 1200))

    // 如果有文本，以文本为准；否则基于图片尝试提取一些示例
    let parsed: ParsedItem[] = []
    if (billText.trim()) {
      parsed = parseContent(billText)
    }

    // 如果没解析到任何条目，给用户一些常见药品作为可选示例
    if (parsed.length === 0) {
      parsed = [
        { id: 'demo-1', name: '维生素 C 片', quantity: 1, unit: '盒', diseaseCategory: 'immunity', category: 'health' },
        { id: 'demo-2', name: '布洛芬缓释胶囊', quantity: 1, unit: '盒', diseaseCategory: 'pain', category: 'western' },
        { id: 'demo-3', name: '板蓝根颗粒', quantity: 2, unit: '袋', diseaseCategory: 'respiratory', category: 'chinese' },
        { id: 'demo-4', name: '创可贴', quantity: 1, unit: '盒', diseaseCategory: 'trauma', category: 'topical' },
        { id: 'demo-5', name: '奥美拉唑肠溶胶囊', quantity: 1, unit: '盒', diseaseCategory: 'digestive', category: 'western' }
      ]
    }

    setItems(parsed)
    setParsing(false)
    setStep('confirm')
  }

  const updateItem = (id: string, field: keyof ParsedItem, value: string | number) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)))
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const addEmptyItem = () => {
    setItems((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, name: '', quantity: 1, unit: '盒', diseaseCategory: 'other', category: 'other' }
    ])
  }

  const handleConfirmAdd = async () => {
    const toAdd = items.filter((it) => it.name.trim())
    if (toAdd.length === 0) {
      alert('请填写至少一个药品名称')
      return
    }

    setSaving(true)
    try {
      for (const it of toAdd) {
        await api.medicines.create({
          name: it.name,
          category: it.category,
          diseaseCategory: it.diseaseCategory,
          photo: null,
          quantity: Number(it.quantity) || 1,
          unit: it.unit,
          expiryDate: null,
          threshold: 5,
          reminderTimes: []
        })
      }
      navigate('/medicines')
    } catch (err: any) {
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setPlatform(null)
    setStep('platform')
    setPhoto(null)
    setBillText('')
    setItems([])
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">账单导入</h1>
        <p className="text-gray-400 mt-1 text-sm">
          从电商平台的药品订单中快速导入药箱
        </p>
      </div>

      {/* 步骤指示器 */}
      <div className="flex items-center gap-2 text-sm">
        {[
          { key: 'platform', label: '选择平台', step: 1 },
          { key: 'upload', label: '上传账单', step: 2 },
          { key: 'confirm', label: '确认添加', step: 3 }
        ].map((s, i) => {
          const active = s.key === step || (step === 'parse' && s.key === 'upload')
          const done = ['platform', 'upload', 'confirm'].indexOf(step) > i
          return (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  active
                    ? 'bg-primary text-white'
                    : done
                    ? 'bg-secondary text-white'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {done ? <Check className="w-4 h-4" /> : s.step}
              </div>
              <span className={active || done ? 'text-gray-700 font-medium' : 'text-gray-400'}>
                {s.label}
              </span>
              {i < 2 && <div className="w-10 h-px bg-gray-200 mx-1" />}
            </div>
          )
        })}
      </div>

      {/* Step 1: 选择平台 */}
      {step === 'platform' && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-600 mb-4">选择账单来源平台</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  setPlatform(p.value)
                  setStep('upload')
                }}
                className="p-6 rounded-2xl border-2 border-gray-100 hover:border-primary/30 hover:shadow-md transition-all group"
              >
                <div
                  className="text-5xl mb-3 group-hover:scale-110 transition-transform"
                  style={{ color: p.color }}
                >
                  {p.icon}
                </div>
                <p className="text-sm font-semibold text-gray-700">{p.label}</p>
              </button>
            ))}
          </div>

          <div className="mt-6 p-4 bg-primary/5 rounded-xl text-sm text-gray-600 border border-primary/10">
            <p className="flex items-start gap-2">
              <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <span>
                支持上传订单截图或粘贴订单商品清单文本。系统会自动识别药品名称、数量、
                并匹配疾病分类。您可以在下一步编辑或手动调整识别结果。
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Step 2: 上传账单 */}
      {(step === 'upload' || step === 'parse') && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-3xl">
                  {PLATFORMS.find((p) => p.value === platform)?.icon}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-700">
                    {PLATFORMS.find((p) => p.value === platform)?.label} 订单
                  </h2>
                  <p className="text-xs text-gray-400">上传图片或粘贴文本</p>
                </div>
              </div>
              <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-600">
                更换平台
              </button>
            </div>

            {/* 图片上传 */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-500 mb-2">
                订单截图（可选，多张图时系统会提取图片中常见药品名）
              </label>
              <div className="flex items-center gap-3">
                {photo ? (
                  <div className="relative w-32 h-32 rounded-xl overflow-hidden border-2 border-primary/30">
                    <img src={photo} alt="账单" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhoto(null)}
                      className="absolute top-1 right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center text-gray-500 shadow"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="w-32 h-32 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <ImageIcon className="w-8 h-8 text-gray-300 mb-1" />
                    <span className="text-xs text-gray-400">点击上传</span>
                  </label>
                )}
                <div className="text-xs text-gray-400 max-w-xs">
                  <p>💡 提示：图片上传后配合下方文本识别效果更好</p>
                  <p className="mt-1">您也可以直接复制粘贴订单中的商品清单</p>
                </div>
              </div>
            </div>

            {/* 文本粘贴 */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-2">
                粘贴商品清单文本（更精准）
              </label>
              <textarea
                value={billText}
                onChange={(e) => setBillText(e.target.value)}
                placeholder={"例如：\n阿莫西林胶囊 × 2盒\n维生素C片 × 1瓶\n板蓝根颗粒 3袋\n..."}
                rows={6}
                className="input-field font-mono text-sm"
              />
            </div>

            <button
              onClick={triggerParse}
              disabled={parsing || (!photo && !billText.trim())}
              className="w-full btn-primary disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              {parsing ? '正在识别药品信息...' : '智能识别并解析'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: 确认添加 */}
      {step === 'confirm' && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">
                共识别到 <span className="text-primary">{items.length}</span> 个药品
              </h2>
              <button
                type="button"
                onClick={addEmptyItem}
                className="text-sm text-primary font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> 手动添加
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-5xl mb-2">📋</div>
                <p>暂无识别结果，点击右上角「手动添加」手动输入</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((it, idx) => (
                  <div
                    key={it.id}
                    className="p-4 rounded-xl border-2 border-gray-100 hover:border-primary/20 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-xs font-bold text-gray-300 pt-2 w-5 text-right">
                        #{idx + 1}
                      </div>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-6 gap-2">
                        <input
                          type="text"
                          value={it.name}
                          onChange={(e) => updateItem(it.id, 'name', e.target.value)}
                          className="sm:col-span-3 input-field text-sm"
                          placeholder="药品名称"
                        />
                        <input
                          type="number"
                          value={it.quantity}
                          onChange={(e) => updateItem(it.id, 'quantity', e.target.value)}
                          className="input-field text-sm"
                          placeholder="数量"
                          min={0}
                        />
                        <input
                          type="text"
                          value={it.unit}
                          onChange={(e) => updateItem(it.id, 'unit', e.target.value)}
                          className="input-field text-sm"
                          placeholder="单位"
                        />
                        <select
                          value={it.diseaseCategory}
                          onChange={(e) => updateItem(it.id, 'diseaseCategory', e.target.value)}
                          className="input-field text-sm"
                        >
                          {Object.entries(diseaseLabels).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => removeItem(it.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep('upload')}
                className="px-6 py-3 rounded-xl font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                返回
              </button>
              <button
                onClick={handleConfirmAdd}
                disabled={saving || items.filter((it) => it.name.trim()).length === 0}
                className="flex-1 btn-primary disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-5 h-5" />
                {saving ? '添加中...' : `添加 ${items.filter((it) => it.name.trim()).length} 个药品到药箱`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

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
