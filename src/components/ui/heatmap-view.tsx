import React, {
  type ForwardedRef,
  type ReactNode,
  forwardRef,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useEffect,
  useState,
} from 'react'
import type { DailyCount } from '@/hooks/use-analytics'

// ---------------------------------------------------------------------------
// Types (same as before – omitted for brevity)
// (All type definitions from your original file stay exactly the same)
// ---------------------------------------------------------------------------
// ... all type definitions go here ...
// (I'm omitting them to keep the answer readable, but they are unchanged)

// ---------------------------------------------------------------------------
// Imperative handle exposed to parent
// ---------------------------------------------------------------------------

export type HeatmapViewRef = {
  switchView: (view: HeatmapViewName) => void
  getActiveView: () => HeatmapViewName | null
  refresh: () => void
  setYear: (year: number) => void
  setYearToHighest: () => void
  setYearToLowest: () => void
  moveToPreviousYear: () => void
  moveToNextYear: () => void
  moveToCurrentYear: () => void
  getYear: () => number
  reset: () => void
  exportData: (format?: string) => void
  getApi: () => any | null
}

// ---------------------------------------------------------------------------
// Component Props (same – omitted)
// ---------------------------------------------------------------------------
export type HeatmapViewProps = {
  // ... all props unchanged ...
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDateString(dateStr: string): Date | null {
  const parts = dateStr.split('-')
  if (parts.length !== 3) return null
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null
  return new Date(year, month, day)
}

function pushDataToHeatJs(
  api: any,
  elementId: string,
  data: DailyCount[],
  type?: string
) {
  if (!api || !data.length) return

  for (let i = 0; i < data.length; i++) {
    const item = data[i]
    if (!item.date || item.count == null) continue

    const date = parseDateString(item.date)
    if (!date) continue

    try {
      api.updateDate(elementId, date, item.count, type, false)
    } catch (e) {
      console.warn('[HeatmapView] updateDate error:', e)
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const HeatmapViewInner = (
  props: HeatmapViewProps,
  ref: ForwardedRef<HeatmapViewRef>
) => {
  const {
    data,
    type = 'Unknown',
    defaultView,
    defaultYear,
    startMonth,
    yearsToHide,
    colorRanges,
    dynamicColorRange,
    holidays,
    views,
    tooltip,
    zooming,
    sideMenu,
    title,
    yearlyStatistics,
    description,
    guide,
    events,
    localeText,
    resizable,
    showOnlyDataForYearsAvailable,
    showHolidaysInDayToolTips,
    dataFetchDelay,
    exportType,
    exportOnlyDataBeingViewed,
    exportDateTimeFormat,
    percentageDecimalPoints,
    chartsAnimationDelay,
    className,
    style,
    children,
  } = props

  const uniqueId = useId()
  const elementId = useMemo(
    () => `heatmap-${uniqueId.replace(/:/g, '')}`,
    [uniqueId]
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<any>(null)
  const renderedRef = useRef(false)
  const isMounted = useRef(true)

  // Build binding options (stable reference)
  const bindingOptions = useMemo(() => {
    const opts: Record<string, unknown> = {}
    if (defaultView !== undefined) opts.defaultView = defaultView
    if (defaultYear !== undefined) opts.defaultYear = defaultYear
    if (startMonth !== undefined) opts.startMonth = startMonth
    if (yearsToHide !== undefined) opts.yearsToHide = yearsToHide
    if (colorRanges !== undefined) opts.colorRanges = colorRanges
    if (dynamicColorRange !== undefined)
      opts.dynamicColorRange = dynamicColorRange
    if (holidays !== undefined) opts.holidays = holidays
    if (views !== undefined) opts.views = views
    if (tooltip !== undefined) opts.tooltip = tooltip
    if (zooming !== undefined) opts.zooming = zooming
    if (sideMenu !== undefined) opts.sideMenu = sideMenu
    if (title !== undefined) opts.title = title
    if (yearlyStatistics !== undefined) opts.yearlyStatistics = yearlyStatistics
    if (description !== undefined) opts.description = description
    if (guide !== undefined) opts.guide = guide
    if (events !== undefined) opts.events = events
    if (resizable !== undefined) opts.resizable = resizable
    if (showOnlyDataForYearsAvailable !== undefined)
      opts.showOnlyDataForYearsAvailable = showOnlyDataForYearsAvailable
    if (showHolidaysInDayToolTips !== undefined)
      opts.showHolidaysInDayToolTips = showHolidaysInDayToolTips
    if (dataFetchDelay !== undefined) opts.dataFetchDelay = dataFetchDelay
    if (exportType !== undefined) opts.exportType = exportType
    if (exportOnlyDataBeingViewed !== undefined)
      opts.exportOnlyDataBeingViewed = exportOnlyDataBeingViewed
    if (exportDateTimeFormat !== undefined)
      opts.exportDateTimeFormat = exportDateTimeFormat
    if (percentageDecimalPoints !== undefined)
      opts.percentageDecimalPoints = percentageDecimalPoints
    if (chartsAnimationDelay !== undefined)
      opts.chartsAnimationDelay = chartsAnimationDelay
    return opts
  }, [
    defaultView, defaultYear, startMonth, yearsToHide, colorRanges,
    dynamicColorRange, holidays, views, tooltip, zooming, sideMenu,
    title, yearlyStatistics, description, guide, events, resizable,
    showOnlyDataForYearsAvailable, showHolidaysInDayToolTips,
    dataFetchDelay, exportType, exportOnlyDataBeingViewed,
    exportDateTimeFormat, percentageDecimalPoints, chartsAnimationDelay,
  ])

  const [libLoaded, setLibLoaded] = useState(false)

  // Load heat.js library
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).$heat) {
      setLibLoaded(true)
      return
    }

    let cancelled = false

    const loadLib = async () => {
      try {
        const heatJs = await import('jheat.js' as any)
        if (cancelled) return
        if ((heatJs as any).default?.render) {
          ; (window as any).$heat = (heatJs as any).default
          setLibLoaded(true)
          return
        }
        for (const key of Object.keys(heatJs)) {
          if (
            typeof (heatJs as any)[key] === 'object' &&
            (heatJs as any)[key].render
          ) {
            ; (window as any).$heat = (heatJs as any)[key]
            setLibLoaded(true)
            return
          }
        }
        console.warn(
          '[HeatmapView] Could not initialize heat.js from npm. Falling back to CDN...'
        )
        loadFromCdn()
      } catch {
        if (!cancelled) loadFromCdn()
      }
    }

    const loadFromCdn = () => {
      const script = document.createElement('script')
      script.src =
        'https://cdn.jsdelivr.net/npm/jheat.js@5.1.0/dist/heat.js'
      script.onload = () => {
        if (!cancelled) setLibLoaded(true)
      }
      script.onerror = () =>
        console.error(
          '[HeatmapView] Failed to load heat.js. Please install jheat.js via npm or add a <script> tag.'
        )
      document.head.appendChild(script)
    }

    loadLib()
    return () => {
      cancelled = true
    }
  }, [])

  // Initial render
  useEffect(() => {
    if (!libLoaded || !containerRef.current) return

    const $heat = (window as any).$heat
    if (!$heat || typeof $heat.render !== 'function') return

    try {
      $heat.render(containerRef.current, bindingOptions)
      apiRef.current = $heat
      renderedRef.current = true

      if (localeText && typeof $heat.setLocale === 'function') {
        $heat.setLocale(localeText, true)
      }
    } catch (e) {
      console.error('[HeatmapView] Render error:', e)
    }

    return () => {
      // Always destroy, regardless of mounted state
      if (apiRef.current && typeof apiRef.current.destroy === 'function') {
        try {
          apiRef.current.destroy(elementId)
        } catch (e) {
          console.warn('[HeatmapView] Destroy error:', e)
        }
      }
      apiRef.current = null
      renderedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libLoaded, elementId])

  // Data update effect
  useEffect(() => {
    if (!libLoaded || !apiRef.current || !renderedRef.current) return
    if (!isMounted.current) return

    const $heat = apiRef.current

    try {
      // Reset with refresh to ensure a clean DOM
      $heat.reset(elementId, true)

      // Push new data
      pushDataToHeatJs($heat, elementId, data, type)

      // Switch to the correct type (triggers refresh)
      $heat.switchType(elementId, type)
    } catch (e) {
      console.error('[HeatmapView] Data update error:', e)
    }
  }, [data, libLoaded, elementId, type])

  // Sync non‑data binding options
  useEffect(() => {
    if (!libLoaded || !apiRef.current) return
    if (!isMounted.current) return

    const $heat = apiRef.current
    if (typeof $heat.updateBindingOptions === 'function') {
      try {
        $heat.updateBindingOptions(elementId, bindingOptions)
      } catch (e) {
        console.warn('[HeatmapView] updateBindingOptions error:', e)
      }
    }
  }, [bindingOptions, libLoaded, elementId])

  // Mounted flag
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  // Imperative handle with try‑catch
  useImperativeHandle(
    ref,
    () => ({
      switchView: (view: HeatmapViewName) => {
        if (isMounted.current && apiRef.current) {
          try {
            apiRef.current.switchView(elementId, view)
          } catch (e) {
            console.warn('[HeatmapView] switchView error:', e)
          }
        }
      },
      getActiveView: () => {
        if (isMounted.current && apiRef.current) {
          try {
            return apiRef.current.getActiveView(elementId) ?? null
          } catch (e) {
            console.warn('[HeatmapView] getActiveView error:', e)
            return null
          }
        }
        return null
      },
      refresh: () => {
        if (isMounted.current && apiRef.current) {
          try {
            apiRef.current.refresh(elementId)
          } catch (e) {
            console.warn('[HeatmapView] refresh error:', e)
          }
        }
      },
      setYear: (year: number) => {
        if (isMounted.current && apiRef.current) {
          try {
            apiRef.current.setYear(elementId, year)
          } catch (e) {
            console.warn('[HeatmapView] setYear error:', e)
          }
        }
      },
      setYearToHighest: () => {
        if (isMounted.current && apiRef.current) {
          try {
            apiRef.current.setYearToHighest(elementId)
          } catch (e) {
            console.warn('[HeatmapView] setYearToHighest error:', e)
          }
        }
      },
      setYearToLowest: () => {
        if (isMounted.current && apiRef.current) {
          try {
            apiRef.current.setYearToLowest(elementId)
          } catch (e) {
            console.warn('[HeatmapView] setYearToLowest error:', e)
          }
        }
      },
      moveToPreviousYear: () => {
        if (isMounted.current && apiRef.current) {
          try {
            apiRef.current.moveToPreviousYear(elementId)
          } catch (e) {
            console.warn('[HeatmapView] moveToPreviousYear error:', e)
          }
        }
      },
      moveToNextYear: () => {
        if (isMounted.current && apiRef.current) {
          try {
            apiRef.current.moveToNextYear(elementId)
          } catch (e) {
            console.warn('[HeatmapView] moveToNextYear error:', e)
          }
        }
      },
      moveToCurrentYear: () => {
        if (isMounted.current && apiRef.current) {
          try {
            apiRef.current.moveToCurrentYear(elementId)
          } catch (e) {
            console.warn('[HeatmapView] moveToCurrentYear error:', e)
          }
        }
      },
      getYear: () => {
        if (isMounted.current && apiRef.current) {
          try {
            return apiRef.current.getYear(elementId) ?? -1
          } catch (e) {
            console.warn('[HeatmapView] getYear error:', e)
            return -1
          }
        }
        return -1
      },
      reset: () => {
        if (isMounted.current && apiRef.current) {
          try {
            apiRef.current.reset(elementId, true)
          } catch (e) {
            console.warn('[HeatmapView] reset error:', e)
          }
        }
      },
      exportData: (format?: string) => {
        if (isMounted.current && apiRef.current) {
          try {
            apiRef.current.export(elementId, format)
          } catch (e) {
            console.warn('[HeatmapView] export error:', e)
          }
        }
      },
      getApi: () => (isMounted.current ? apiRef.current : null),
    }),
    [elementId]
  )

  return (
    <div
      ref={containerRef}
      id={elementId}
      className={className}
      style={style}
    >
      {children}
    </div>
  )
}

export const HeatmapView = forwardRef<HeatmapViewRef>(HeatmapViewInner)
HeatmapView.displayName = 'HeatmapView'
export default HeatmapView
