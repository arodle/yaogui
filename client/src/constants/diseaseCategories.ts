export const DEFAULT_DISEASE_CATEGORIES = [
  { value: 'respiratory', label: '呼吸系统', icon: '🫁' },
  { value: 'cardiovascular', label: '心血管', icon: '❤️' },
  { value: 'digestive', label: '消化系统', icon: '🫃' },
  { value: 'pain', label: '疼痛/发热', icon: '🤒' },
  { value: 'immunity', label: '免疫/保健', icon: '🛡️' },
  { value: 'allergy', label: '过敏', icon: '🌿' },
  { value: 'trauma', label: '外伤', icon: '🩹' },
  { value: 'diabetes', label: '糖尿病', icon: '🩸' },
  { value: 'sleep', label: '睡眠/神经', icon: '😴' },
  { value: 'other', label: '其他', icon: '📦' }
]

const DEFAULT_DISEASE_CATEGORY_MAP = Object.fromEntries(
  DEFAULT_DISEASE_CATEGORIES.map((item) => [item.value, item])
) as Record<string, { value: string; label: string; icon: string }>

export function getDiseaseMeta(category: string) {
  return DEFAULT_DISEASE_CATEGORY_MAP[category] || {
    value: category,
    label: category,
    icon: '🩺'
  }
}

export function getDiseaseLabel(category: string) {
  return getDiseaseMeta(category).label
}

export function buildDiseaseOptions(categories: string[]) {
  const seen = new Set<string>()
  const merged = [
    ...DEFAULT_DISEASE_CATEGORIES.map((item) => item.value),
    ...categories.filter(Boolean)
  ]

  return merged
    .filter((value) => {
      if (seen.has(value)) return false
      seen.add(value)
      return true
    })
    .map((value) => getDiseaseMeta(value))
}
