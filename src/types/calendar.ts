export type DateKey = string

export type EventColor = "red" | "blue" | "green"

export type BaseEvent = {
  id: string
  name: string
  dateKey: DateKey
  color: EventColor
}

export type FullDayEvent = BaseEvent & {
  allDay: true
}

export type TimedEvent = BaseEvent & {
  allDay: false
  startTime: string
  endTime: string
}

export type CalendarEvent = FullDayEvent | TimedEvent

export type CalendarCursor = {
  year: number
  monthIndex: number
}

export type EventFormErrors = {
  name?: string
  time?: string
}
