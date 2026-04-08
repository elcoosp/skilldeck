'use client'

import { useEffect, useRef, useState } from 'react'

const SCROLL_THRESHOLD = 50
const _RAF_THROTTLE = 16 // ~60fps

export function useScrollPosition() {
  const scrollYRef = useRef(0)
  const [isScrolled, setIsScrolled] = useState(() => false)
  const tickingRef = useRef(false)

  useEffect(() => {
    const handleScroll = () => {
      scrollYRef.current = window.scrollY

      if (!tickingRef.current) {
        tickingRef.current = true
        requestAnimationFrame(() => {
          const thresholdMet = scrollYRef.current > SCROLL_THRESHOLD
          setIsScrolled((prev) => (prev !== thresholdMet ? thresholdMet : prev))
          tickingRef.current = false
        })
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    // Initial check
    scrollYRef.current = window.scrollY
    setIsScrolled(scrollYRef.current > SCROLL_THRESHOLD)

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return isScrolled
}
