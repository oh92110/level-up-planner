import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { formatDuration } from '../lib/dates'
import { PRIORITY_META } from '../lib/types'
import type { Task } from '../lib/types'

/** Movement before a press turns into a drag, so taps don't reschedule things. */
const THRESHOLD = 5
const EDGE = 90
const EDGE_SPEED = 14

interface DragContextValue {
  begin: (task: Task, e: ReactPointerEvent) => void
  /** The task being dragged, once past the movement threshold. */
  dragging: Task | null
  hovered: string | null
  registerZone: (id: string) => (el: HTMLElement | null) => void
}

const DragContext = createContext<DragContextValue | null>(null)

export function useDrag(): DragContextValue {
  const ctx = useContext(DragContext)
  if (!ctx) throw new Error('useDrag must be used inside DragProvider')
  return ctx
}

export function DragProvider({
  children,
  onDrop,
}: {
  children: ReactNode
  onDrop: (task: Task, zoneId: string) => void
}) {
  const zones = useRef(new Map<string, HTMLElement>())
  const origin = useRef({ x: 0, y: 0 })
  const pointer = useRef({ x: 0, y: 0 })
  const candidate = useRef<Task | null>(null)
  const active = useRef(false)
  const scrollFrame = useRef<number | null>(null)

  const [dragging, setDragging] = useState<Task | null>(null)
  const [ghost, setGhost] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState<string | null>(null)

  const registerZone = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) zones.current.set(id, el)
      else zones.current.delete(id)
    },
    [],
  )

  /** Smallest zone containing the point wins, so inner slots beat their day card. */
  const hitTest = useCallback((x: number, y: number): string | null => {
    let best: { id: string; area: number } | null = null
    for (const [id, el] of zones.current) {
      const r = el.getBoundingClientRect()
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue
      const area = r.width * r.height
      if (!best || area < best.area) best = { id, area }
    }
    return best?.id ?? null
  }, [])

  const stopAutoScroll = useCallback(() => {
    if (scrollFrame.current != null) cancelAnimationFrame(scrollFrame.current)
    scrollFrame.current = null
  }, [])

  const begin = useCallback((task: Task, e: ReactPointerEvent) => {
    candidate.current = task
    active.current = false
    origin.current = { x: e.clientX, y: e.clientY }
    pointer.current = { x: e.clientX, y: e.clientY }
  }, [])

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!candidate.current) return
      pointer.current = { x: e.clientX, y: e.clientY }

      if (!active.current) {
        const dx = e.clientX - origin.current.x
        const dy = e.clientY - origin.current.y
        if (Math.hypot(dx, dy) < THRESHOLD) return
        active.current = true
        setDragging(candidate.current)
      }

      e.preventDefault()
      setGhost({ x: e.clientX, y: e.clientY })
      const id = hitTest(e.clientX, e.clientY)
      setHovered((prev) => (prev === id ? prev : id))
    }

    function onUp() {
      const task = candidate.current
      const wasActive = active.current
      candidate.current = null
      active.current = false
      stopAutoScroll()
      setDragging(null)
      setHovered(null)
      if (!task || !wasActive) return
      const id = hitTest(pointer.current.x, pointer.current.y)
      if (id) onDrop(task, id)
    }

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [hitTest, onDrop, stopAutoScroll])

  // Scroll the page when the pointer is held near the top or bottom edge.
  useEffect(() => {
    if (!dragging) return
    function tick() {
      const y = pointer.current.y
      if (y < EDGE) window.scrollBy(0, -EDGE_SPEED * (1 - y / EDGE))
      else if (y > window.innerHeight - EDGE)
        window.scrollBy(0, EDGE_SPEED * (1 - (window.innerHeight - y) / EDGE))
      scrollFrame.current = requestAnimationFrame(tick)
    }
    scrollFrame.current = requestAnimationFrame(tick)
    return stopAutoScroll
  }, [dragging, stopAutoScroll])

  return (
    <DragContext.Provider value={{ begin, dragging, hovered, registerZone }}>
      {children}
      {dragging &&
        createPortal(
          <div
            className="fixed z-[200] pointer-events-none select-none -translate-y-1/2 translate-x-3"
            style={{ left: ghost.x, top: ghost.y }}
          >
            <div
              className="flex items-center gap-2 rounded-lg border border-cyan/60 bg-ink-900/95 px-3 py-2
                shadow-[0_0_0_1px_rgba(34,229,255,.25),0_18px_40px_-10px_rgba(0,0,0,.8)] backdrop-blur rotate-1"
            >
              <span className="text-[10px] leading-none">{PRIORITY_META[dragging.priority].dot}</span>
              <span className="text-sm font-medium text-slate-100 max-w-[14rem] truncate">{dragging.name}</span>
              <span className="mono-num text-[11px] text-cyan-soft">{formatDuration(dragging.duration_min)}</span>
            </div>
          </div>,
          document.body,
        )}
    </DragContext.Provider>
  )
}

/** Wraps a droppable area; highlights itself while the pointer is over it mid-drag. */
export function DropZone({
  id,
  children,
  className = '',
  activeClassName = 'border-cyan/70 bg-cyan/10 shadow-glow',
  idleClassName = '',
}: {
  id: string
  children: ReactNode
  className?: string
  activeClassName?: string
  idleClassName?: string
}) {
  const { registerZone, dragging, hovered } = useDrag()
  const isTarget = dragging != null && hovered === id
  return (
    <div
      ref={registerZone(id)}
      className={`transition-[background-color,border-color,box-shadow] duration-150 ${className} ${
        isTarget ? activeClassName : idleClassName
      }`}
    >
      {children}
    </div>
  )
}
