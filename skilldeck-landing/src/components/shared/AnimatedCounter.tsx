'use client'

import { useEffect, useRef, useState } from 'react'

export function AnimatedCounter({
  target,
  duration = 2000,
  className,
  prefix = '',
  suffix = '',
}: {
  target: number
  duration?: number
  className?: string
  prefix?: string
  suffix?: string
}) {
  const [count, setCount] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const targetRef = useRef(target)
  const durationRef = useRef(duration)

  useEffect(() => {
    targetRef.current = target
    durationRef.current = duration
    startTimeRef.current = null

    const step = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp
      }

      const elapsed = timestamp - startTimeRef.current
      const dur = durationRef.current
      const progress = Math.min(elapsed / dur, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.floor(eased * targetRef.current)

      setCount(current)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }

    rafRef.current = requestAnimationFrame(step)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [target, duration])

  return (
    <span className={className}>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  )
}
