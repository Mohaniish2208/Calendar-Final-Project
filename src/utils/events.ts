import type { CalendarEvent, DateKey } from "../types/calendar"

function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
  const aKey = a.allDay ? "" : a.startTime
  const bKey = b.allDay ? "" : b.startTime

  return aKey.localeCompare(bKey)
}

export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(compareEvents)
}

export function groupEventsByDate(events: CalendarEvent[]): Record<DateKey, CalendarEvent[]> {
  const eventMap: Record<DateKey, CalendarEvent[]> = {}

  for (const calendarEvent of sortEvents(events)) {
    if (!eventMap[calendarEvent.dateKey]) {
      eventMap[calendarEvent.dateKey] = []
    }

    eventMap[calendarEvent.dateKey].push(calendarEvent)
  }

  return eventMap
}

export function splitVisibleEvents(events: CalendarEvent[], maxVisible: number): { visible: CalendarEvent[]; overflow: number } {
  const visible = events.slice(0, maxVisible)
  const overflow = events.length - visible.length

  return { visible, overflow }
}
