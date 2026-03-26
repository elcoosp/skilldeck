import HeatMap from '@uiw/react-heat-map'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { DailyCount } from '@/hooks/use-analytics'
import { useMemo } from 'react'
import { differenceInWeeks } from 'date-fns'

interface AnalyticsHeatmapProps {
  messagesData: DailyCount[]
  conversationsData: DailyCount[]
  /** Start date for the heatmap */
  startDate: Date
  /** End date for the heatmap */
  endDate: Date
  /** If true, display compact (no overflow‑x) */
  compact?: boolean
}

export function AnalyticsHeatmap({
  messagesData,
  conversationsData,
  startDate,
  endDate,
  compact = false,
}: AnalyticsHeatmapProps) {
  // Format for heatmap library: expects 'YYYY/MM/DD' strings
  const formatForHeatmap = (data: DailyCount[]) => {
    return data.map(item => ({
      date: item.date.replace(/-/g, '/'),
      count: item.count,
    }))
  }

  const messagesHeatmapData = formatForHeatmap(messagesData)
  const conversationsHeatmapData = formatForHeatmap(conversationsData)

  const panelColors = [
    'var(--muted)',
    '#e4b293',
    '#d48462',
    '#c2533a',
    '#ad001d',
    '#6c0012',
  ]

  // Calculate width based on date range
  const width = useMemo(() => {
    if (!compact) {
      // For full year, width is fixed large enough to fit 52 weeks
      return 880
    }
    const weeks = Math.max(1, differenceInWeeks(endDate, startDate) + 1)
    const computedWidth = (12 + 2) * weeks + 40
    return Math.min(computedWidth, 680)
  }, [compact, startDate, endDate])

  const commonProps = {
    width,
    rectSize: 12,
    space: 2,
    panelColors,
    weekLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    monthLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    style: { backgroundColor: 'transparent' },
  }

  const RectWithTooltip = ({
    props,
    data,
    label,
  }: {
    props: React.SVGProps<SVGRectElement>
    data: any
    label: string
  }) => {
    const count = data.count ?? 0
    const { date } = data
    const tooltipContent = count
      ? `${date}: ${count} ${count === 1 ? label : label + 's'}`
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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Messages per day
        </h3>
        <div className={compact ? '' : 'overflow-x-auto'}>
          <div style={{ minWidth: compact ? 'auto' : `${width}px` }}>
            <HeatMap
              {...commonProps}
              value={messagesHeatmapData}
              startDate={startDate}
              endDate={endDate}
              rectRender={(props, data) => (
                <RectWithTooltip props={props} data={data} label="message" />
              )}
            />
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Conversations per day
        </h3>
        <div className={compact ? '' : 'overflow-x-auto'}>
          <div style={{ minWidth: compact ? 'auto' : `${width}px` }}>
            <HeatMap
              {...commonProps}
              value={conversationsHeatmapData}
              startDate={startDate}
              endDate={endDate}
              rectRender={(props, data) => (
                <RectWithTooltip props={props} data={data} label="conversation" />
              )}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
