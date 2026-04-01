import HeatMap from '@uiw/react-heat-map'
import { differenceInWeeks } from 'date-fns'
import { useMemo } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import type { DailyCount } from '@/hooks/use-analytics'

interface AnalyticsHeatmapProps {
  messagesData: DailyCount[]
  conversationsData: DailyCount[]
  startDate: Date
  endDate: Date
  compact?: boolean
}

export function AnalyticsHeatmap({
  messagesData,
  conversationsData,
  startDate,
  endDate,
  compact = false
}: AnalyticsHeatmapProps) {
  // Convert dates to YYYY/MM/DD format required by the library
  const formatForHeatmap = (data: DailyCount[]) =>
    data.map((item) => ({
      date: item.date.replace(/-/g, '/'),
      count: item.count
    }))

  const messagesHeatmapData = formatForHeatmap(messagesData)
  const conversationsHeatmapData = formatForHeatmap(conversationsData)

  // Explicit color thresholds – zero = neutral gray, positive counts = greens
  const panelColors = {
    0: '#ebedf0', // no data
    1: '#9be9a4', // 1–3
    4: '#40c463', // 4–9
    10: '#30a14e', // 10–24
    25: '#216e39', // 25–49
    50: '#0e4429' // 50+
  }

  // Compute width for each heatmap based on the date range (weeks)
  const width = useMemo(() => {
    const weeks = Math.max(1, differenceInWeeks(endDate, startDate) + 1)
    const computedWidth = (12 + 2) * weeks + 40 // rectSize=12, space=2
    if (compact) {
      return Math.min(computedWidth, 680) // cap for compact view
    }
    // Full‑year mode: allow larger width (e.g., up to 1200px)
    return Math.min(computedWidth, 1200)
  }, [compact, startDate, endDate])

  const commonProps = {
    width,
    rectSize: 12,
    space: 2,
    panelColors,
    weekLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    monthLabels: [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ],
    style: { backgroundColor: 'transparent' }
  }

  const RectWithTooltip = ({
    props,
    data,
    label
  }: {
    props: React.SVGProps<SVGRectElement>
    data: any
    label: string
  }) => {
    const count = data.count ?? 0
    const { date } = data
    const tooltipContent = count
      ? `${date}: ${count} ${count === 1 ? label : `${label}s`}`
      : `${date}: no ${label}s`

    return (
      <TooltipProvider>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <rect
              {...props}
              className="transition-all hover:stroke-2 hover:stroke-primary cursor-pointer"
            />
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">{tooltipContent}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Render a single heatmap block
  const HeatmapBlock = ({
    label,
    data
  }: {
    label: string
    data: Array<{ date: string; count: number }>
  }) => (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
        {label}
      </h3>
      <div className={compact ? '' : 'overflow-x-auto'}>
        <div style={{ minWidth: compact ? 'auto' : `${width}px` }}>
          <HeatMap
            {...commonProps}
            value={data}
            startDate={startDate}
            endDate={endDate}
            rectRender={(props, data) => (
              <RectWithTooltip
                props={props}
                data={data}
                label={label.toLowerCase().replace(/ per day/i, '')}
              />
            )}
          />
        </div>
      </div>
    </div>
  )

  return compact ? (
    // Compact mode: flex row, wrap, center horizontally
    <div className="flex flex-wrap justify-center gap-6">
      <HeatmapBlock label="Messages per day" data={messagesHeatmapData} />
      <HeatmapBlock
        label="Conversations per day"
        data={conversationsHeatmapData}
      />
    </div>
  ) : (
    // Full‑year mode: stacked
    <div className="space-y-6">
      <HeatmapBlock label="Messages per day" data={messagesHeatmapData} />
      <HeatmapBlock
        label="Conversations per day"
        data={conversationsHeatmapData}
      />
    </div>
  )
}
