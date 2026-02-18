export type DateKey = string

export type EventColor = "red" | "blue" | "green"

export type BaseEvent = {
  id: string
  name: string
  dateKey: DateKey
  color: EventColor
}

export type CalendarEvent = (BaseEvent & { allDay: true }) | (BaseEvent & { allDay: false; startTime: string; endTime: string })
