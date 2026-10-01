export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function today(): string {
  return toISO(new Date())
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = fromISO(fromIso).getTime()
  const b = fromISO(toIso).getTime()
  return Math.round((b - a) / 86400000)
}

/** Week starts Monday. */
export function weekStart(iso: string): string {
  const d = fromISO(iso)
  const dow = d.getDay()
  return addDays(iso, dow === 0 ? -6 : 1 - dow)
}

export function weekDates(startIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startIso, i))
}

export function weekdayOf(iso: string): number {
  return fromISO(iso).getDay()
}

export function formatLong(iso: string): string {
  return fromISO(iso).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function formatShort(iso: string): string {
  return fromISO(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function formatTime(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const suffix = h < 12 ? 'AM' : 'PM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hr} ${suffix}` : `${hr}:${String(m).padStart(2, '0')} ${suffix}`
}

export function minutesOfDay(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Minutes-of-day back to the "HH:MM" shape the database stores. */
export function toHHMM(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = Math.round(min) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatMinutesOfDay(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  const suffix = h < 12 ? 'AM' : 'PM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hr} ${suffix}` : `${hr}:${String(m).padStart(2, '0')} ${suffix}`
}

export function nowMinutes(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} hr` : `${h}h ${m}m`
}

export function relativeDue(iso: string | null, ref = today()): { text: string; tone: 'over' | 'urgent' | 'soon' | 'far' } | null {
  if (!iso) return null
  const d = daysBetween(ref, iso)
  if (d < 0) return { text: d === -1 ? 'Overdue by 1 day' : `Overdue by ${-d} days`, tone: 'over' }
  if (d === 0) return { text: 'Due today', tone: 'urgent' }
  if (d === 1) return { text: 'Due tomorrow', tone: 'urgent' }
  if (d <= 7) return { text: `Due in ${d} days`, tone: 'soon' }
  if (d <= 60) return { text: `Due ${formatShort(iso)}`, tone: 'far' }
  return { text: `Due ${fromISO(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`, tone: 'far' }
}
