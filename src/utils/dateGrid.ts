import type { DateKey } from "../types/calendar"

export type DayCell = { dateKey: DateKey; inMonth: boolean }

export function toDateKey(date: Date): DateKey {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")

  return `${y}-${m}-${d}` as DateKey
}

export function fromDateKey(dateKey: DateKey): Date {
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function isTodayDateKey(dateKey: DateKey): boolean {
  return dateKey === toDateKey(new Date())
}

export function isPastDateKey(dateKey: DateKey): boolean {
  const now = new Date()
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = fromDateKey(dateKey)

  return target.getTime() < todayMidnight.getTime()
}

export function formatShortDate(dateKey: DateKey): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  }).format(fromDateKey(dateKey))
}

export function formatMonthLabel(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthIndex, 1))
}

export function addMonths(
  year: number,
  monthIndex: number,
  delta: number,
): { year: number; monthIndex: number } {
  const total = year * 12 + monthIndex + delta
  const newYear = Math.floor(total / 12)
  const newMonthIndex = ((total % 12) + 12) % 12

  return { year: newYear, monthIndex: newMonthIndex }
}

export function getMonthMatrix(year: number, monthIndex: number): DayCell[][] {
  const firstDay = new Date(year, monthIndex, 1)
  const startOffset = firstDay.getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const totalVisibleDays = startOffset + daysInMonth
  const visibleWeeks = Math.ceil(totalVisibleDays / 7)
  const gridStart = new Date(year, monthIndex, 1 - startOffset)
  const matrix: DayCell[][] = []

  for (let row = 0; row < visibleWeeks; row++) {
    const week: DayCell[] = []

    for (let col = 0; col < 7; col++) {
      const i = row * 7 + col
      const cellDate = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)

      week.push({
        dateKey: toDateKey(cellDate),
        inMonth: cellDate.getMonth() === monthIndex,
      })
    }

    matrix.push(week)
  }

  return matrix
}
