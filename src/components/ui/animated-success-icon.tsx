import { motion } from 'framer-motion'
import { CheckCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface AnimatedSuccessIconProps {
  className?: string
  duration?: number
  onComplete?: () => void
}

export function AnimatedSuccessIcon({
  className,
  duration = 1500,
  onComplete
}: AnimatedSuccessIconProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onComplete?.()
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onComplete])

  if (!visible) return null

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={cn('inline-flex', className)}
    >
      <CheckCircle className="size-4 text-green-500" />
    </motion.div>
  )
}
