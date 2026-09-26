import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { PRIORITY_META } from '../lib/types'
import type { Priority } from '../lib/types'

export function Card({
  children,
  className = '',
  hoverable = false,
}: {
  children: ReactNode
  className?: string
  hoverable?: boolean
}) {
  return (
    <div
      className={`card p-4 sm:p-5 transition-[transform,box-shadow,border-color] duration-200 ${
        hoverable ? 'hover:-translate-y-0.5 hover:border-ink-600 hover:shadow-lg' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

export function SectionHeading({
  title,
  action,
  className = '',
}: {
  title: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-center justify-between gap-3 mb-3 ${className}`}>
      <h2 className="section-title">{title}</h2>
      {action}
    </div>
  )
}

export function PriorityChip({ priority, compact = false }: { priority: Priority; compact?: boolean }) {
  const meta = PRIORITY_META[priority]
  if (compact) return <span aria-label={meta.label}>{meta.dot}</span>
  return (
    <span className={`chip ${meta.bg}`}>
      <span>{meta.dot}</span>
      {meta.label}
    </span>
  )
}

export function ProgressBar({
  value,
  className = '',
  tone = 'accent',
}: {
  value: number
  className?: string
  tone?: 'accent' | 'good'
}) {
  const color = tone === 'good' ? 'bg-lo' : 'bg-accent'
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={`h-1.5 w-full rounded-full bg-ink-800 overflow-hidden ${className}`}>
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      />
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
    const timeout = window.setTimeout(() => setMounted(false), 200)
    return () => window.clearTimeout(timeout)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        className={`relative w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} max-h-[92dvh] overflow-y-auto
          bg-ink-900 border border-ink-700 rounded-t-2xl sm:rounded-2xl shadow-2xl
          transition-[opacity,transform] duration-200 ease-out ${
            visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-[0.98]'
          }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 bg-ink-900/95 backdrop-blur border-b border-ink-800 px-5 py-3.5 flex items-center justify-between">
          <h3 className="font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose} className="btn-quiet px-2 py-1" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="text-center py-8 px-4"
    >
      <div className="text-2xl mb-2 opacity-60">{icon}</div>
      <p className="text-sm text-slate-500">{text}</p>
    </motion.div>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="section-title mb-1.5">{label}</p>
      <p className="text-2xl font-semibold text-slate-100 leading-none">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1.5">{sub}</p>}
    </div>
  )
}

export function AnimatedNumber({ value, duration = 500 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)

  useEffect(() => {
    const from = fromRef.current
    if (from === value) return
    const start = performance.now()
    let frame: number
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <>{display}</>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}
