'use client'

import React from 'react'
import { toast as sonnerToast, Toaster as SonnerToaster } from 'sonner'
import {
  X,
  CheckCircle,
  AlertTriangle,
  Info,
  XCircle,
  Loader2,
} from 'lucide-react'
import { motion } from 'framer-motion'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ToastType = 'default' | 'success' | 'error' | 'info' | 'warning' | 'loading'

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastOptions {
  description?: string
  action?: ToastAction
  dismissible?: boolean
  duration?: number
}

interface InternalToastProps extends ToastOptions {
  id: string | number
  type: ToastType
  message: string
}

/* ------------------------------------------------------------------ */
/*  Text Generate Effect (Slowed down for clear visibility)            */
/* ------------------------------------------------------------------ */

function ToastTextEffect({ words }: { words: string }) {
  const wordsArray = words.split(' ')

  // Start halfway through Sonner's slide, with a long stagger per word
  const baseDelay = 0.15
  const stagger = 0.05

  return (
    <>
      {wordsArray.map((word, idx) => (
        <motion.span
          key={word + idx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: baseDelay + (idx * stagger),
            ease: 'easeOut',
          }}
          className="inline-block"
        >
          {word}{idx < wordsArray.length - 1 ? '\u00A0' : ''}
        </motion.span>
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const typeConfig: Record<ToastType, { gradient: string; iconBg: string; iconColor: string }> = {
  default: {
    gradient: 'from-[var(--brand-primary-light)]/5 to-transparent',
    iconBg: 'bg-[var(--brand-primary-light)]/15',
    iconColor: 'text-[var(--brand-primary-light)]',
  },
  success: {
    gradient: 'from-[var(--brand-primary-light)]/10 to-transparent',
    iconBg: 'bg-[var(--brand-primary-light)]/15',
    iconColor: 'text-[var(--brand-primary-light)]',
  },
  error: {
    gradient: 'from-[var(--destructive)]/10 to-transparent',
    iconBg: 'bg-[var(--destructive)]/15',
    iconColor: 'text-[var(--destructive)]',
  },
  info: {
    gradient: 'from-[var(--info-bg)]/10 to-transparent',
    iconBg: 'bg-[var(--info-bg)]/15',
    iconColor: 'text-[var(--info-bg)]',
  },
  warning: {
    gradient: 'from-[var(--accent)]/10 to-transparent',
    iconBg: 'bg-[var(--accent)]/15',
    iconColor: 'text-[var(--accent)]',
  },
  loading: {
    gradient: 'from-[var(--brand-primary-light)]/5 to-transparent',
    iconBg: 'bg-[var(--brand-primary-light)]/15',
    iconColor: 'text-[var(--brand-primary-light)]',
  },
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

const typeIcons: Record<ToastType, React.ReactNode> = (
  [
    ['default', <Info className="h-4 w-4" />],
    ['success', <CheckCircle className="h-4 w-4" />],
    ['error', <XCircle className="h-4 w-4" />],
    ['info', <Info className="h-4 w-4" />],
    ['warning', <AlertTriangle className="h-4 w-4" />],
    ['loading', <Loader2 className="h-4 w-4 animate-spin" />],
  ] as const
).reduce((acc, [key, icon]) => ({ ...acc, [key]: icon }), {}) as Record<ToastType, React.ReactNode>

/* ------------------------------------------------------------------ */
/*  Toast Component (Always Animated)                                  */
/* ------------------------------------------------------------------ */

function Toast({
  id,
  type,
  message,
  description,
  action,
  dismissible = true,
}: InternalToastProps) {
  const config = typeConfig[type]

  return (
    <div
      className={`
        relative flex w-full max-w-[420px] items-center gap-3 overflow-hidden
        rounded-xl border p-4
        bg-white dark:bg-[var(--card)]
        border-[var(--normal-border)] dark:border-[var(--border)]
        shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]
        backdrop-blur-sm
        bg-gradient-to-r ${config.gradient}
      `}
    >
      {/* Icon Pill (Always Animates) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.05, ease: 'easeOut' }}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.iconBg}`}
      >
        <div className={config.iconColor}>
          {typeIcons[type]}
        </div>
      </motion.div>

      {/* Body */}
      <div className="min-w-0 flex-1 text-[var(--normal-text)]">
        <div className="text-sm font-semibold tracking-tight">
          <ToastTextEffect words={message} />
        </div>
        {description && (
          <p className="mt-0.5 text-sm leading-relaxed text-[var(--muted-foreground)]">
            {description}
          </p>
        )}
      </div>

      {/* Action Button */}
      {action && (
        <button
          onClick={() => {
            action.onClick()
            sonnerToast.dismiss(id)
          }}
          className={`
            shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold
            transition-all duration-150
            bg-[var(--brand-primary-light)]/10 text-[var(--brand-primary-light)]
            hover:bg-[var(--brand-primary-light)]/20
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary-light)]
          `}
        >
          {action.label}
        </button>
      )}

      {/* Dismiss Button */}
      {dismissible && !action && (
        <button
          onClick={() => sonnerToast.dismiss(id)}
          className={`
            shrink-0 rounded-lg p-1.5
            text-[var(--muted-foreground)]/60
            hover:text-[var(--normal-text)] hover:bg-black/5 dark:hover:bg-white/5
            transition-all duration-150
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current
          `}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Internal factory                                                   */
/* ------------------------------------------------------------------ */

function createToast(options: Omit<InternalToastProps, 'id'>) {
  return sonnerToast.custom((id) => <Toast id={id} {...options} />)
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export const toast = {
  default: (message: string, options?: ToastOptions) =>
    createToast({ type: 'default', message, ...options }),
  success: (message: string, options?: ToastOptions) =>
    createToast({ type: 'success', message, ...options }),
  error: (message: string, options?: ToastOptions) =>
    createToast({ type: 'error', message, ...options }),
  info: (message: string, options?: ToastOptions) =>
    createToast({ type: 'info', message, ...options }),
  warning: (message: string, options?: ToastOptions) =>
    createToast({ type: 'warning', message, ...options }),
  loading: (message: string, options?: ToastOptions) =>
    createToast({ type: 'loading', message, ...options }),
  dismiss: sonnerToast.dismiss,
  promise: <T,>(
    promise: Promise<T>,
    opts: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((err: unknown) => string)
    },
    options?: ToastOptions,
  ) =>
    sonnerToast.promise(promise, {
      loading: () =>
        createToast({ type: 'loading', message: opts.loading, ...options }),
      success: (data: T) =>
        createToast({
          type: 'success',
          message:
            typeof opts.success === 'function' ? opts.success(data) : opts.success,
          ...options,
        }),
      error: (err: unknown) =>
        createToast({
          type: 'error',
          message:
            typeof opts.error === 'function' ? opts.error(err) : opts.error,
          ...options,
        }),
    }),
} as const

/* ------------------------------------------------------------------ */
/*  Toaster                                                            */
/* ------------------------------------------------------------------ */

export function Toaster(props?: {
  position?:
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  gap?: number
}) {
  return (
    <SonnerToaster
      position={props?.position ?? 'bottom-right'}
      gap={props?.gap ?? 10}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            '!block !p-0 !m-0 !border-0 !shadow-none !outline-none !ring-0 !gap-0 !overflow-visible',
        },
      }}
    />
  )
}
