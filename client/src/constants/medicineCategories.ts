export const DEFAULT_MEDICINE_CATEGORIES = [
  { value: 'western', label: '西药' },
  { value: 'chinese', label: '中药' },
  { value: 'health', label: '保健品' },
  { value: 'topical', label: '外用药' },
  { value: 'other', label: '其他' }
]

export const DEFAULT_MEDICINE_CATEGORY_LABELS: Record<string, string> = {
  western: '西药',
  chinese: '中药',
  health: '保健品',
  topical: '外用药',
  other: '其他'
}

export function getCategoryLabel(category: string) {
  return DEFAULT_MEDICINE_CATEGORY_LABELS[category] || category
}

export function buildCategoryOptions(categories: string[]) {
  const seen = new Set<string>()
  const merged = [
    ...DEFAULT_MEDICINE_CATEGORIES.map((item) => item.value),
    ...categories.filter(Boolean)
  ]

  return merged
    .filter((value) => {
      if (seen.has(value)) return false
      seen.add(value)
      return true
    })
    .map((value) => ({ value, label: getCategoryLabel(value) }))
}
