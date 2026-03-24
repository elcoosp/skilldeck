import HeatMap from '@uiw/react-heat-map'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { DailyCount } from '@/hooks/use-analytics'

interface AnalyticsHeatmapProps {
  messagesData: DailyCount[]
  conversationsData: DailyCount[]
}

export function AnalyticsHeatmap({ messagesData, conversationsData }: AnalyticsHeatmapProps) {
  // Convert our data format to the library's expected format: { date: 'YYYY/MM/DD', count: number }
  const formatForHeatmap = (data: DailyCount[]) => {
    return data.map(item => ({
      date: item.date.replace(/-/g, '/'), // "2024-01-01" → "2024/01/01"
      count: item.count,
    }))
  }

  const messagesHeatmapData = formatForHeatmap(messagesData)
  const conversationsHeatmapData = formatForHeatmap(conversationsData)

  // Color palette matching brand (low to high intensity)
  const panelColors = [
    'var(--muted)',          // 0
    '#e4b293',               // 1
    '#d48462',               // 2
    '#c2533a',               // 3
    '#ad001d',               // 4
    '#6c0012'                // 5+
  ]

  const commonProps = {
    width: 680,
    rectSize: 12,
    space: 2,
    panelColors,
    weekLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    monthLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    style: { backgroundColor: 'transparent' },
  }

  // Determine the start date (first day of the year of the earliest data, or default to 12 months ago)
  const allDates = [...messagesData, ...conversationsData].map(d => new Date(d.date))
  const minDate = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date()
  const startDate = new Date(minDate.getFullYear(), 0, 1) // Jan 1 of that year

  // Helper to render a rect with tooltip
  const RectWithTooltip = ({ props, data, label }: { props: React.SVGProps<SVGRectElement>; data: any; label: string }) => {
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
        <HeatMap
          {...commonProps}
          value={messagesHeatmapData}
          startDate={startDate}
          rectRender={(props, data) => (
            <RectWithTooltip props={props} data={data} label="message" />
          )}
        />
      </div>
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Conversations per day
        </h3>
        <HeatMap
          {...commonProps}
          value={conversationsHeatmapData}
          startDate={startDate}
          rectRender={(props, data) => (
            <RectWithTooltip props={props} data={data} label="conversation" />
          )}
        />
      </div>
    </div>
  )
}
