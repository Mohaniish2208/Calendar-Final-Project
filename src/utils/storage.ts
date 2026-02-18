import type { CalendarEvent } from "../types/calendar"

const KEY = "calendar_events_v1"

export function loadEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as CalendarEvent[]) : []
  } catch {
    return []
  }
}

export function saveEvents(events: CalendarEvent[]): void {
  localStorage.setItem(KEY, JSON.stringify(events))
}
