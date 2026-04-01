
import { useRef } from 'react'
import {
  HeatmapView,
  type HeatmapViewRef,
  type HeatmapViewProps,
  type HeatmapColorRange,
  type HeatmapDynamicColorRange,
} from '@/components/ui/heatmap-view'
import type { DailyCount } from '@/hooks/use-analytics'

// ---------------------------------------------------------------------------
// 6-level green color scale
// ---------------------------------------------------------------------------

const GREEN_COLOR_RANGES: HeatmapColorRange[] = [
  { id: 'level-0', name: 'No data', minimum: 0, cssClassName: 'heat-green-0' },
  { id: 'level-1', name: '1–3', minimum: 1, cssClassName: 'heat-green-1' },
  { id: 'level-2', name: '4–9', minimum: 4, cssClassName: 'heat-green-2' },
  { id: 'level-3', name: '10–24', minimum: 10, cssClassName: 'heat-green-3' },
  { id: 'level-4', name: '25–49', minimum: 25, cssClassName: 'heat-green-4' },
  { id: 'level-5', name: '50+', minimum: 50, cssClassName: 'heat-green-5' },
]

// ---------------------------------------------------------------------------
// Inline <style> — 6-level green palette for all heat.js views
// ---------------------------------------------------------------------------

const HEATMAP_GREEN_COLORS_CSS = /* css */ `
  .heat-green-0 {
    background-color: var(--muted) !important;
    fill: var(--muted) !important;
  }
  .heat-green-1 {
    background-color: #9be9a4 !important;
    fill: #9be9a4 !important;
  }
  .heat-green-2 {
    background-color: #40c463 !important;
    fill: #40c463 !important;
  }
  .heat-green-3 {
    background-color: #30a14e !important;
    fill: #30a14e !important;
  }
  .heat-green-4 {
    background-color: #216e39 !important;
    fill: #216e39 !important;
  }
  .heat-green-5 {
    background-color: #0e4429 !important;
    fill: #0e4429 !important;
  }
`

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AnalyticsHeatmapProps {
  messagesData: DailyCount[]
  conversationsData: DailyCount[]
  /** Start date for the heatmap */
  startDate: Date
  /** End date for the heatmap */
  endDate: Date
  /** If true, display compact (minimal chrome) */
  compact?: boolean
}

// ---------------------------------------------------------------------------
// Shared view configuration builder
// ---------------------------------------------------------------------------

function buildViewConfig(compact: boolean): HeatmapViewProps['views'] {
  return {
    map: {
      enabled: true,
      showMonthNames: true,
      showDayNames: compact ? false : true,
      showMinimalDayNames: compact ? true : false,
      showDayCounts: false,
      showDayDateNumbers: false,
      showSpacing: true,
      highlightCurrentDay: true,
      showToolTips: true,
      showCountsInToolTips: true,
      placeMonthNamesOnTheBottom: true,
    },
    line: {
      enabled: !compact,
      showMonthNames: true,
      showToolTips: true,
      showCountsInToolTips: true,
    },
    chart: {
      enabled: !compact,
      showChartYLabels: true,
      showMonthNames: true,
      showToolTips: true,
      showCountsInToolTips: true,
      showHorizontalChartLines: true,
      usePoints: true,
      usePointLines: true,
      addMonthSpacing: true,
      useGradients: true,
    },
    days: {
      enabled: !compact,
      showChartYLabels: true,
      showDayNames: true,
      showDayCounts: true,
      showToolTips: true,
      showHorizontalChartLines: true,
      useGradients: true,
      useDifferentOpacities: true,
    },
    months: {
      enabled: !compact,
      showChartYLabels: true,
      showMonthNames: true,
      showMonthCounts: true,
      showToolTips: true,
      showHorizontalChartLines: true,
      useGradients: true,
      useDifferentOpacities: true,
    },
    colorRanges: {
      enabled: !compact,
      showChartYLabels: true,
      showRangeCounts: true,
      showToolTips: true,
      showHorizontalChartLines: true,
      useGradients: true,
    },
  }
}

// ---------------------------------------------------------------------------
// Single heatmap section
// ---------------------------------------------------------------------------

function HeatmapSection({
  label,
  data,
  startDate,
  endDate,
  compact,
  colorRanges,
  dynamicColorRange,
}: {
  label: string
  data: DailyCount[]
  startDate: Date
  endDate: Date
  compact: boolean
  colorRanges: HeatmapColorRange[]
  dynamicColorRange: HeatmapDynamicColorRange
}) {
  const ref = useRef<HeatmapViewRef>(null)

  const views = buildViewConfig(compact)

  const defaultYear = compact
    ? startDate.getFullYear()
    : undefined

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </h3>
      <div className="heatmap-container">
        <HeatmapView
          ref={ref}
          data={data}
          type={label.toLowerCase().replace(/ per day/i, '')}
          defaultView="map"
          defaultYear={defaultYear}
          startMonth={1}
          colorRanges={colorRanges}
          dynamicColorRange={dynamicColorRange}
          views={views}
          tooltip={{
            delay: 200,
          }}
          sideMenu={{
            enabled: !compact,
            showToolTips: true,
          }}
          title={
            compact
              ? {
                showText: false,
                showYearSelector: true,
                showSectionText: false,
              }
              : {
                showText: false,
                showYearSelector: true,
                showSectionText: true,
                showRefreshButton: true,
                showExportButton: true,
                showCurrentYearButton: true,
              }
          }
          yearlyStatistics={{
            enabled: !compact,
            showToday: true,
            showThisWeek: true,
            showThisMonth: true,
            showThisYear: true,
            showPercentages: true,
          }}
          zooming={{
            enabled: !compact,
            defaultLevel: 0,
            maximumLevel: 0,
            showCloseButton: true,
            showResetButton: false,
          }}
          guide={{
            enabled: true,
            colorRangeTogglesEnabled: !compact,
            showLessAndMoreLabels: true,
            showNumbersInGuide: compact ? false : true,
            showInvertLabel: false,
            allowTypeAdding: false,
            allowTypeRemoving: false,
          }}
          resizable={false}
          className={compact ? 'compact-heatmap' : ''}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AnalyticsHeatmap (main export)
// ---------------------------------------------------------------------------

export function AnalyticsHeatmap({
  messagesData,
  conversationsData,
  startDate,
  endDate,
  compact = false,
}: AnalyticsHeatmapProps) {
  return (
    <>
      {/* Inject 6-level green color range CSS for heat.js */}
      <style dangerouslySetInnerHTML={{ __html: HEATMAP_GREEN_COLORS_CSS }} />

      <div className="space-y-6">
        {/* Messages heatmap — all 6 views available */}
        <HeatmapSection
          label="Messages per day"
          data={messagesData}
          startDate={startDate}
          endDate={endDate}
          compact={compact}
          colorRanges={GREEN_COLOR_RANGES}
          dynamicColorRange={{
            enabled: true,
            color: '#216e39',
            totalColors: 5,
            startMinimum: 1,
            maximumMinimum: 50,
            startName: 'Light',
            overrideCheckBoxColors: true,
          }}
        />

        {/* Conversations heatmap — all 6 views available */}
        <HeatmapSection
          label="Conversations per day"
          data={conversationsData}
          startDate={startDate}
          endDate={endDate}
          compact={compact}
          colorRanges={GREEN_COLOR_RANGES}
          dynamicColorRange={{
            enabled: true,
            color: '#216e39',
            totalColors: 5,
            startMinimum: 1,
            maximumMinimum: 50,
            startName: 'Light',
            overrideCheckBoxColors: true,
          }}
        />
      </div>
    </>
  )
}
