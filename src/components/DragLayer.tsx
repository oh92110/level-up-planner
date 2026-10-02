import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { formatDuration } from '../lib/dates'
import { PRIORITY_META } from '../lib/types'
import type { Task } from '../lib/types'

/** Movement before a press becomes a drag, so taps still click. */
const THRESHOLD = 5
const EDGE = 100
const EDGE_SPEED = 18

interface Hit {
  id: string
  el: HTMLElement
}

interface DragContextValue {
  begin: (task: Task, e: ReactPointerEvent) => void
  dragging: Task | null
  /** True just after a drag finished, so the trailing click can be ignored. */
  didJustDrag: () => boolean
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
  /** ratio is how far down the drop zone the pointer landed, 0–1. */
  onDrop: (task: Task, zoneId: string, ratio: number) => void
}) {
  const zones = useRef(new Map<string, HTMLElement>())
  const ghostRef = useRef<HTMLDivElement>(null)
  const highlighted = useRef<HTMLElement | null>(null)
  const hit = useRef<Hit | null>(null)
  const candidate = useRef<Task | null>(null)
  const active = useRef(false)
  const origin = useRef({ x: 0, y: 0 })
  const pointer = useRef({ x: 0, y: 0 })
  const frame = useRef<number | null>(null)
  const endedAt = useRef(0)

  // Only changes at drag start/end — never per pointer move.
  const [dragging, setDragging] = useState<Task | null>(null)

  const registerZone = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) zones.current.set(id, el)
      else zones.current.delete(id)
    },
    [],
  )

  /** Smallest zone under the point wins, so a time slot beats its day card. */
  const hitTest = useCallback((x: number, y: number): Hit | null => {
    let best: (Hit & { area: number }) | null = null
    for (const [id, el] of zones.current) {
      const r = el.getBoundingClientRect()
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue
      const area = r.width * r.height
      if (!best || area < best.area) best = { id, el, area }
    }
    return best ? { id: best.id, el: best.el } : null
  }, [])

  const setHighlight = useCallback((el: HTMLElement | null) => {
    if (highlighted.current === el) return
    highlighted.current?.classList.remove('drop-target')
    el?.classList.add('drop-target')
    highlighted.current = el
  }, [])

  const stopScroll = useCallback(() => {
    if (frame.current != null) cancelAnimationFrame(frame.current)
    frame.current = null
  }, [])

  const begin = useCallback((task: Task, e: ReactPointerEvent) => {
    candidate.current = task
    active.current = false
    origin.current = { x: e.clientX, y: e.clientY }
    pointer.current = { x: e.clientX, y: e.clientY }
  }, [])

  const didJustDrag = useCallback(() => Date.now() - endedAt.current < 250, [])

  useEffect(() => {
    function paint(x: number, y: number) {
      const g = ghostRef.current
      if (!g) return
      g.style.transform = `translate3d(${x}px, ${y}px, 0)`
      g.style.visibility = 'visible'
    }

    function autoScroll() {
      const y = pointer.current.y
      if (y < EDGE) window.scrollBy(0, -EDGE_SPEED * (1 - y / EDGE))
      else if (y > window.innerHeight - EDGE)
        window.scrollBy(0, EDGE_SPEED * (1 - (window.innerHeight - y) / EDGE))
      frame.current = requestAnimationFrame(autoScroll)
    }

    function onMove(e: PointerEvent) {
      if (!candidate.current) return
      pointer.current = { x: e.clientX, y: e.clientY }

      if (!active.current) {
        if (Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) < THRESHOLD) return
        active.current = true
        setDragging(candidate.current)
        frame.current = requestAnimationFrame(autoScroll)
      }

      e.preventDefault()
      paint(e.clientX, e.clientY)
      const next = hitTest(e.clientX, e.clientY)
      hit.current = next
      setHighlight(next?.el ?? null)
    }

    function onUp() {
      const task = candidate.current
      const wasDrag = active.current
      candidate.current = null
      active.current = false
      stopScroll()
      setHighlight(null)
      if (ghostRef.current) ghostRef.current.style.visibility = 'hidden'

      if (!wasDrag) return
      endedAt.current = Date.now()
      setDragging(null)

      const target = hit.current
      hit.current = null
      if (!task || !target) return
      const r = target.el.getBoundingClientRect()
      const ratio = r.height > 0 ? (pointer.current.y - r.top) / r.height : 0
      onDrop(task, target.id, Math.max(0, Math.min(1, ratio)))
    }

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      stopScroll()
    }
  }, [hitTest, onDrop, setHighlight, stopScroll])

  return (
    <DragContext.Provider value={{ begin, dragging, didJustDrag, registerZone }}>
      {children}
      {createPortal(
        <div
          ref={ghostRef}
          className="fixed left-0 top-0 z-[200] pointer-events-none select-none"
          style={{ visibility: 'hidden' }}
        >
          <div className="-translate-y-1/2 translate-x-4">
            {dragging && (
              <div className="flex items-center gap-2 rounded-md border border-cyan/50 bg-ink-900 px-2.5 py-1.5 shadow-2xl">
                <span className="text-[10px] leading-none">{PRIORITY_META[dragging.priority].dot}</span>
                <span className="text-[13px] font-medium text-slate-100 max-w-[13rem] truncate">{dragging.name}</span>
                <span className="mono-num text-[11px] text-cyan">{formatDuration(dragging.duration_min)}</span>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </DragContext.Provider>
  )
}

/** A droppable area. Highlighting is applied imperatively, so this never re-renders mid-drag. */
export function DropZone({
  id,
  children,
  className = '',
  style,
}: {
  id: string
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const { registerZone } = useDrag()
  return (
    <div ref={registerZone(id)} className={className} style={style}>
      {children}
    </div>
  )
}
