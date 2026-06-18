interface PieChartItem {
  label: string
  count: number
}

interface PieChartSummaryProps {
  items: PieChartItem[]
  total: number
  colors: string[]
  emptyText?: string
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians)
  }
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle)
  const end = polarToCartesian(cx, cy, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`
}

export function PieChartSummary({
  items,
  total,
  colors,
  emptyText = '还没有可统计的数据。'
}: PieChartSummaryProps) {
  if (!items.length || total <= 0) {
    return <div className="py-12 text-center text-gray-400">{emptyText}</div>
  }

  let currentAngle = 0
  const slices = items.map((item, index) => {
    const percentage = item.count / total
    const startAngle = currentAngle
    const endAngle = currentAngle + percentage * 360
    currentAngle = endAngle

    return {
      ...item,
      color: colors[index % colors.length],
      percentage: Math.round(percentage * 100),
      path: describeArc(110, 110, 90, startAngle, endAngle)
    }
  })

  return (
    <div className="space-y-5">
      <div className="flex justify-center">
        <div className="relative w-[220px] h-[220px]">
          <svg viewBox="0 0 220 220" className="w-full h-full drop-shadow-sm">
            {slices.map((slice) => (
              <path key={slice.label} d={slice.path} fill={slice.color} stroke="#fff" strokeWidth="2" />
            ))}
            <circle cx="110" cy="110" r="44" fill="white" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm text-gray-400">总计</span>
            <span className="text-3xl font-bold text-gray-800">{total}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {slices.map((slice) => (
          <div key={slice.label} className="rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: slice.color }} />
                <span className="font-medium text-gray-800">{slice.label}</span>
              </div>
              <span className="text-sm text-gray-500">
                {slice.count} 个 · {slice.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
