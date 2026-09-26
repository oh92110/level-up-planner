import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface ToastItem {
  id: number
  text: string
  tone: 'default' | 'success' | 'danger'
}

interface ToastContextValue {
  toast: (text: string, tone?: ToastItem['tone']) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue['toast'] {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx.toast
}

const TONE_STYLE: Record<ToastItem['tone'], string> = {
  default: 'bg-ink-800 border-ink-600 text-slate-100',
  success: 'bg-lo/15 border-lo/40 text-lo',
  danger: 'bg-hi/15 border-hi/40 text-hi',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const toast = useCallback((text: string, tone: ToastItem['tone'] = 'default') => {
    const id = nextId.current++
    setItems((prev) => [...prev, { id, text, tone }])
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 2600)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-20 sm:bottom-6 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className={`chip border shadow-card px-3.5 py-2 text-sm font-medium backdrop-blur ${TONE_STYLE[item.tone]}`}
            >
              {item.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
