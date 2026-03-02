import type { CalendarEvent, EventColor } from "../types/calendar"

const STORAGE_KEY = "calendar_events_v1"

function isEventColor(value: unknown): value is EventColor {
  return value === "red" || value === "blue" || value === "green"
}

function normalizeEvent(raw: unknown): CalendarEvent | null {
  if (!raw || typeof raw !== "object") return null

  const maybeEvent = raw as Partial<CalendarEvent>
  const hasBaseFields =
    typeof maybeEvent.id === "string" &&
    typeof maybeEvent.name === "string" &&
    typeof maybeEvent.dateKey === "string" &&
    isEventColor(maybeEvent.color)

  if (!hasBaseFields || typeof maybeEvent.allDay !== "boolean") {
    return null
  }

  if (maybeEvent.allDay) {
    return {
      id: maybeEvent.id,
      name: maybeEvent.name,
      dateKey: maybeEvent.dateKey,
      color: maybeEvent.color,
      allDay: true,
    }
  }

  if (typeof maybeEvent.startTime !== "string" || typeof maybeEvent.endTime !== "string") {
    return null
  }

  return {
    id: maybeEvent.id,
    name: maybeEvent.name,
    dateKey: maybeEvent.dateKey,
    color: maybeEvent.color,
    allDay: false,
    startTime: maybeEvent.startTime,
    endTime: maybeEvent.endTime,
  }
}

export function loadEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.flatMap((entry) => {
      const normalizedEvent = normalizeEvent(entry)
      return normalizedEvent ? [normalizedEvent] : []
    })
  } catch {
    return []
  }
}

export function saveEvents(events: CalendarEvent[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
}
