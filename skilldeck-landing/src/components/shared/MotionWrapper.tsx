'use client'

import dynamic from 'next/dynamic'

const MotionDiv = dynamic(
  () => import('framer-motion').then((mod) => mod.motion.div),
  {
    ssr: false
  }
)

const MotionSpan = dynamic(
  () => import('framer-motion').then((mod) => mod.motion.span),
  {
    ssr: false
  }
)

export function MotionWrapper({
  children,
  className,
  initial,
  whileInView,
  viewport,
  transition
}: {
  children: React.ReactNode
  className?: string
  initial?: object
  whileInView?: object
  viewport?: object
  transition?: object
}) {
  return (
    <MotionDiv
      className={className}
      initial={initial}
      whileInView={whileInView}
      viewport={viewport}
      transition={transition}
    >
      {children}
    </MotionDiv>
  )
}

export function MotionSpanWrapper({
  children,
  className,
  initial,
  whileInView,
  viewport,
  transition
}: {
  children: React.ReactNode
  className?: string
  initial?: object
  whileInView?: object
  viewport?: object
  transition?: object
}) {
  return (
    <MotionSpan
      className={className}
      initial={initial}
      whileInView={whileInView}
      viewport={viewport}
      transition={transition}
    >
      {children}
    </MotionSpan>
  )
}
