import { useCallback, useRef } from 'react'

/** Registry of droppable rects, hit-tested on drag end. Keyed by an opaque string id. */
export function useDropZones() {
  const zones = useRef(new Map<string, HTMLElement>())

  const register = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) zones.current.set(id, el)
      else zones.current.delete(id)
    },
    [],
  )

  const hitTest = useCallback((point: { x: number; y: number }): string | null => {
    for (const [id, el] of zones.current.entries()) {
      const r = el.getBoundingClientRect()
      if (point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom) {
        return id
      }
    }
    return null
  }, [])

  return { register, hitTest }
}
