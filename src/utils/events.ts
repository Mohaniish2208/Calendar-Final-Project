import type { CalendarEvent, DateKey } from "../types/calendar"

export function eventsForDate(events: CalendarEvent[], dateKey: DateKey): CalendarEvent[] {
  return events.filter((e) => e.dateKey === dateKey)
}

export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
  const aKey = a.allDay ? "" : a.startTime
  const bKey = b.allDay ? "" : b.startTime

  return aKey.localeCompare(bKey)
}

export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(compareEvents)
}

export function splitVisibleEvents(events: CalendarEvent[], maxVisible: number) {
  const visible = events.slice(0, maxVisible)
  const overflow = events.length - visible.length

  return { visible, overflow }
}
