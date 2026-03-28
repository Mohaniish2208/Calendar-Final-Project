import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, RefObject } from "react"
import type { CalendarCursor, CalendarEvent, DateKey, EventColor, EventFormErrors } from "../../types/calendar"
import type { DayCell as CalendarDayCell } from "../../utils/dateGrid"
import { addMonths, formatMonthLabel, formatShortDate, getMonthMatrix, isPastDateKey, isTodayDateKey } from "../../utils/dateGrid"
import { groupEventsByDate, splitVisibleEvents } from "../../utils/events"
import { loadEvents, saveEvents } from "../../utils/storage"

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const COLOR_OPTIONS: EventColor[] = ["red", "green", "blue"]

const DEFAULT_START_TIME = "09:00"
const DEFAULT_END_TIME = "10:00"
const MODAL_ANIMATION_MS = 220
const MAX_EVENTS_PER_CELL = 3
const handleCaps = (text: string) => {
  return text.replace(/^(\s*)([a-z])/, (_, spaces, firstLetter) => {
    return spaces + firstLetter.toUpperCase()
  })
}

type CalendarProps = {
  allowPastEvents?: boolean
}

type EventDraft = {
  name: string
  allDay: boolean
  startTime: string
  endTime: string
  color: EventColor
}

type EventItemProps = {
  calendarEvent: CalendarEvent
  onSelect?: (calendarEvent: CalendarEvent) => void
  showTimeRange?: boolean
  measureOnly?: boolean
}

type ModalFrameProps = {
  isClosing: boolean
  labelledBy: string
  size?: "default" | "compact"
  onClose: () => void
  children: React.ReactNode
}

type EventModalProps = {
  dateKey: DateKey
  draft: EventDraft
  errors: EventFormErrors
  isClosing: boolean
  isEditing: boolean
  onDraftChange: (patch: Partial<EventDraft>) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}

type ViewMoreModalProps = {
  dateKey: DateKey
  dayEvents: CalendarEvent[]
  isClosing: boolean
  onEditEvent: (calendarEvent: CalendarEvent) => void
  onClose: () => void
}

type DayCellProps = {
  calendarDay: CalendarDayCell
  columnIndex: number
  rowIndex: number
  dayEvents: CalendarEvent[]
  allowPastEvents: boolean
  onAddEvent: (dateKey: DateKey) => void
  onEditEvent: (calendarEvent: CalendarEvent) => void
  onViewMore: (dateKey: DateKey) => void
}

type CalendarGridProps = {
  visibleWeeks: CalendarDayCell[][]
  eventMap: Record<DateKey, CalendarEvent[]>
  allowPastEvents: boolean
  onAddEvent: (dateKey: DateKey) => void
  onEditEvent: (calendarEvent: CalendarEvent) => void
  onViewMore: (dateKey: DateKey) => void
}

type CalendarHeaderProps = {
  monthLabel: string
  onGoPrev: () => void
  onGoToday: () => void
  onGoNext: () => void
}

function createEmptyDraft(): EventDraft {
  return {
    name: "",
    allDay: true,
    startTime: DEFAULT_START_TIME,
    endTime: DEFAULT_END_TIME,
    color: "blue",
  }
}

function clearTimer(timerRef: { current: number | null }): void {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }
}

function swatchColor(value: EventColor): string {
  if (value === "red") return "var(--event-red)"
  if (value === "blue") return "var(--event-blue)"
  return "var(--event-green)"
}

function swatchSurfaceColor(value: EventColor): string {
  if (value === "red") return "var(--event-red-soft)"
  if (value === "blue") return "var(--event-blue-soft)"
  return "var(--event-green-soft)"
}

function eventAriaLabel(calendarEvent: CalendarEvent, showTimeRange: boolean): string {
  if (calendarEvent.allDay) {
    return `${calendarEvent.name}, all day`
  }

  const timeLabel = showTimeRange ? `${calendarEvent.startTime} to ${calendarEvent.endTime}` : calendarEvent.startTime
  return `${calendarEvent.name}, ${timeLabel}`
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => !element.hasAttribute("aria-hidden"))
}

function useModalFocusTrap(isOpen: boolean, dialogRef: RefObject<HTMLDivElement | null>, onClose: () => void): void {
  useEffect(() => {
    if (!isOpen) return

    const dialogElement = dialogRef.current
    if (!dialogElement) return

    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const focusFrame = window.requestAnimationFrame(() => {
      const [firstFocusableElement] = getFocusableElements(dialogElement)
      ;(firstFocusableElement ?? dialogElement).focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== "Tab") return

      const focusableElements = getFocusableElements(dialogElement)
      if (focusableElements.length === 0) {
        event.preventDefault()
        dialogElement.focus()
        return
      }

      const firstFocusableElement = focusableElements[0]
      const lastFocusableElement = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey && activeElement === firstFocusableElement) {
        event.preventDefault()
        lastFocusableElement.focus()
      }

      if (!event.shiftKey && activeElement === lastFocusableElement) {
        event.preventDefault()
        firstFocusableElement.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener("keydown", handleKeyDown)
      previousActiveElement?.focus()
    }
  }, [dialogRef, isOpen, onClose])
}

const EventItem = memo(function EventItem({ calendarEvent, onSelect, showTimeRange = false, measureOnly = false }: EventItemProps) {
  const isInteractive = !measureOnly && typeof onSelect === "function"
  const timeLabel = calendarEvent.allDay ? "" : showTimeRange ? `${calendarEvent.startTime} - ${calendarEvent.endTime}` : calendarEvent.startTime
  const eventItemClasses = `eventItem ${calendarEvent.allDay ? "eventItem--allDay" : "eventItem--timed"}${measureOnly ? " eventItem--measure" : ""}`
  const eventColorStyles = {
    "--event-accent": swatchColor(calendarEvent.color),
    "--event-surface": swatchSurfaceColor(calendarEvent.color),
  } as CSSProperties

  return (
    <button
      type="button"
      className={eventItemClasses}
      onClick={isInteractive ? () => onSelect(calendarEvent) : undefined}
      style={eventColorStyles}
      title={eventAriaLabel(calendarEvent, showTimeRange)}
      aria-label={eventAriaLabel(calendarEvent, showTimeRange)}
      aria-hidden={measureOnly}
      tabIndex={measureOnly ? -1 : 0}
      data-event-measure={measureOnly ? "true" : undefined}
    >
      {!calendarEvent.allDay && (
        <span className="eventItem__time" aria-hidden="true">
          {timeLabel}
        </span>
      )}

      <span className="eventItem__label">{calendarEvent.name}</span>
    </button>
  )
})

function ModalFrame({ isClosing, labelledBy, size = "default", onClose, children }: ModalFrameProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const modalClasses = `modalCard${size === "compact" ? " modalCard--compact" : ""} ${isClosing ? "out" : "in"}`

  useModalFocusTrap(!isClosing, dialogRef, onClose)

  return (
    <div
      className={`modalBackdrop ${isClosing ? "out" : "in"}`}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={modalClasses}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose()
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}

function EventModal({ dateKey, draft, errors, isClosing, isEditing, onDraftChange, onSave, onDelete, onClose }: EventModalProps) {
  const titleId = useId()
  const nameInputId = useId()
  const timeErrorId = useId()

  return (
    <ModalFrame isClosing={isClosing} labelledBy={titleId} onClose={onClose}>
      <div className="modalHeader">
        <div className="modalHeaderCopy">
          <p className="modalEyebrow">Event</p>
          <h2 id={titleId} className="modalTitle">
            {isEditing ? "Edit Event" : "Add Event"}
          </h2>
          <p className="modalDate">{formatShortDate(dateKey)}</p>
        </div>

        <button type="button" className="btn btn--ghost modalClose" aria-label="Close dialog" onClick={onClose}>
          {"\u00D7"}
        </button>
      </div>

      <div className="modalBody">
        <label className="formField" htmlFor={nameInputId}>
          <span className="formLabel">
            Name
            <span className="requiredMark" aria-hidden="true">
              *
            </span>
          </span>

          <input
            id={nameInputId}
            type="text"
            className={`formInput${errors.name ? " formInput--error" : ""}`}
            value={draft.name}
            onChange={(e) => onDraftChange({ name: handleCaps(e.target.value) })}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? `${nameInputId}-error` : undefined}
            required
          />

          {errors.name && (
            <span id={`${nameInputId}-error`} className="formError" role="alert">
              {errors.name}
            </span>
          )}
        </label>

        <label className="checkboxField">
          <input type="checkbox" checked={draft.allDay} onChange={(event) => onDraftChange({ allDay: event.target.checked })} />
          <span>All day</span>
        </label>

        <div className="timeGrid">
          <label className="formField">
            <span className="formLabel">Start Time</span>
            <input
              type="time"
              className={`formInput${errors.time ? " formInput--error" : ""}`}
              value={draft.startTime}
              onChange={(event) => onDraftChange({ startTime: event.target.value })}
              disabled={draft.allDay}
              aria-invalid={!draft.allDay && Boolean(errors.time)}
              aria-describedby={errors.time && !draft.allDay ? timeErrorId : undefined}
            />
          </label>

          <label className="formField">
            <span className="formLabel">End Time</span>
            <input
              type="time"
              className={`formInput${errors.time ? " formInput--error" : ""}`}
              value={draft.endTime}
              onChange={(event) => onDraftChange({ endTime: event.target.value })}
              disabled={draft.allDay}
              aria-invalid={!draft.allDay && Boolean(errors.time)}
              aria-describedby={errors.time && !draft.allDay ? timeErrorId : undefined}
            />
          </label>
        </div>

        {errors.time && !draft.allDay && (
          <span id={timeErrorId} className="formError" role="alert">
            {errors.time}
          </span>
        )}

        <fieldset className="colorField">
          <legend className="formLabel">Color</legend>

          <div className="colorSwatches">
            {COLOR_OPTIONS.map((colorOption) => (
              <button
                key={colorOption}
                type="button"
                className={`colorSwatch${draft.color === colorOption ? " colorSwatch--selected" : ""}`}
                onClick={() => onDraftChange({ color: colorOption })}
                style={{ background: swatchColor(colorOption) }}
                aria-label={`Select ${colorOption} color`}
                aria-pressed={draft.color === colorOption}
              />
            ))}
          </div>
        </fieldset>

        <div className="modalActions">
          {isEditing ? (
            <button type="button" className="btn btn--danger" onClick={onDelete}>
              Delete
            </button>
          ) : (
            <span className="modalActionsSpacer" aria-hidden="true" />
          )}

          <div className="modalActionGroup">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>

            <button type="button" className="btn btn--primary" onClick={onSave}>
              {isEditing ? "Save Changes" : "Add Event"}
            </button>
          </div>
        </div>
      </div>
    </ModalFrame>
  )
}

function ViewMoreModal({ dateKey, dayEvents, isClosing, onEditEvent, onClose }: ViewMoreModalProps) {
  const titleId = useId()

  return (
    <ModalFrame isClosing={isClosing} labelledBy={titleId} size="compact" onClose={onClose}>
      <div className="modalHeader">
        <div className="modalHeaderCopy">
          <p className="modalEyebrow">Day Details</p>
          <h2 id={titleId} className="modalTitle">
            {formatShortDate(dateKey)}
          </h2>
        </div>

        <button type="button" className="btn btn--ghost modalClose" aria-label="Close dialog" onClick={onClose}>
          {"\u00D7"}
        </button>
      </div>

      <div className="modalList">
        {dayEvents.length === 0 ? (
          <p className="emptyState">No events scheduled.</p>
        ) : (
          dayEvents.map((calendarEvent) => <EventItem key={calendarEvent.id} calendarEvent={calendarEvent} onSelect={onEditEvent} showTimeRange />)
        )}
      </div>
    </ModalFrame>
  )
}

const DayCell = memo(function DayCell({ calendarDay, columnIndex, rowIndex, dayEvents, allowPastEvents, onAddEvent, onEditEvent, onViewMore }: DayCellProps) {
  const visibleEventsRef = useRef<HTMLDivElement>(null)
  const measureEventsRef = useRef<HTMLDivElement>(null)
  const moreButtonMeasureRef = useRef<HTMLButtonElement>(null)

  const isToday = isTodayDateKey(calendarDay.dateKey)
  const isPast = isPastDateKey(calendarDay.dateKey)
  const canCreateEvent = allowPastEvents || !isPast

  const dayCellClasses = ["dayCell", !calendarDay.inMonth ? "dayCell--outside" : "", isPast ? "dayCell--past" : ""].filter(Boolean).join(" ")

  const measureVisibleEvents = useCallback(() => {
    const visibleEventsElement = visibleEventsRef.current
    const measureEventsElement = measureEventsRef.current

    if (!visibleEventsElement || !measureEventsElement) return
    if (dayEvents.length === 0) {
      return
    }

    const availableHeight = visibleEventsElement.clientHeight
    if (availableHeight <= 0) return

    const rowGap = Number.parseFloat(window.getComputedStyle(visibleEventsElement).rowGap || "0")
    const eventHeights = Array.from(measureEventsElement.querySelectorAll<HTMLElement>("[data-event-measure='true']")).map((element) => element.offsetHeight)
    const fallbackHeight = eventHeights[0] ?? 0
    const moreButtonHeight = moreButtonMeasureRef.current?.offsetHeight ?? fallbackHeight

    let usedHeight = 0
    let visibleCount = 0

    for (let index = 0; index < eventHeights.length; index += 1) {
      const nextHeight = visibleCount === 0 ? eventHeights[index] : usedHeight + rowGap + eventHeights[index]
      const hasOverflow = index < eventHeights.length - 1
      const reservedMoreHeight = hasOverflow ? rowGap + moreButtonHeight : 0

      if (nextHeight + reservedMoreHeight > availableHeight) {
        break
      }

      usedHeight = nextHeight
      visibleCount += 1
    }

    if (visibleCount === 0 && eventHeights.length === 1) {
      visibleCount = 1
    }

    if (visibleCount === 0 && eventHeights.length > 1) {
      visibleCount = moreButtonHeight <= availableHeight ? 0 : 1
    }
  }, [dayEvents.length])

  useEffect(() => {
    const visibleEventsElement = visibleEventsRef.current
    if (!visibleEventsElement) return

    const measurementFrame = window.requestAnimationFrame(() => {
      measureVisibleEvents()
    })

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureVisibleEvents)
      return () => {
        window.cancelAnimationFrame(measurementFrame)
        window.removeEventListener("resize", measureVisibleEvents)
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      measureVisibleEvents()
    })

    resizeObserver.observe(visibleEventsElement)
    const dayCellElement = visibleEventsElement.closest(".dayCell")
    if (dayCellElement instanceof HTMLElement) {
      resizeObserver.observe(dayCellElement)
    }

    return () => {
      window.cancelAnimationFrame(measurementFrame)
      resizeObserver.disconnect()
    }
  }, [measureVisibleEvents])

  const { visible: visibleEvents, overflow } = splitVisibleEvents(dayEvents, MAX_EVENTS_PER_CELL)

  const handleKeyboardOpen = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!canCreateEvent) return

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onAddEvent(calendarDay.dateKey)
    }
  }

  return (
    <div
      className={dayCellClasses}
      role="gridcell"
      tabIndex={0}
      aria-label={`${formatShortDate(calendarDay.dateKey)}${!calendarDay.inMonth ? ", outside current month" : ""}${isPast ? ", past date" : ""}`}
      onKeyDown={handleKeyboardOpen}
    >
      <div className="dayCellHeader">
        <div className="dayCellHeaderMain">
          {rowIndex === 0 && <span className="weekdayLabel">{WEEK_DAYS[columnIndex]}</span>}

          <span className={`dayNumber${isToday ? " dayNumber--today" : ""}`}>{Number(calendarDay.dateKey.slice(-2))}</span>
        </div>

        <button
          type="button"
          className="btn btn--ghost addBtn"
          onPointerUp={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onAddEvent(calendarDay.dateKey)
          }}
          disabled={!canCreateEvent}
          aria-label={`Add event on ${formatShortDate(calendarDay.dateKey)}`}
        >
          +
        </button>
      </div>

      <div ref={visibleEventsRef} className="dayCellEvents">
        {visibleEvents.map((calendarEvent) => (
          <EventItem key={calendarEvent.id} calendarEvent={calendarEvent} onSelect={onEditEvent} />
        ))}

        {overflow > 0 && (
          <button type="button" className="btn btn--more moreBtn" onClick={() => onViewMore(calendarDay.dateKey)}>
            + {overflow} more
          </button>
        )}
      </div>

      <div ref={measureEventsRef} className="dayCellEvents dayCellEvents--measure" aria-hidden="true">
        {dayEvents.map((calendarEvent) => (
          <EventItem key={`measure-${calendarEvent.id}`} calendarEvent={calendarEvent} measureOnly />
        ))}

        <button ref={moreButtonMeasureRef} type="button" className="btn btn--more moreBtn" tabIndex={-1}>
          +99 more
        </button>
      </div>
    </div>
  )
})

const CalendarGrid = memo(function CalendarGrid({ visibleWeeks, eventMap, allowPastEvents, onAddEvent, onEditEvent, onViewMore }: CalendarGridProps) {
  return (
    <div className="calendarGrid" role="grid" aria-label="Monthly calendar" style={{ gridTemplateRows: `repeat(${visibleWeeks.length}, minmax(var(--calendar-row-min-height), 1fr))` }}>
      {visibleWeeks.map((week, rowIndex) =>
        week.map((calendarDay, columnIndex) => (
          <DayCell
            key={calendarDay.dateKey}
            calendarDay={calendarDay}
            rowIndex={rowIndex}
            columnIndex={columnIndex}
            dayEvents={eventMap[calendarDay.dateKey] ?? []}
            allowPastEvents={allowPastEvents}
            onAddEvent={onAddEvent}
            onEditEvent={onEditEvent}
            onViewMore={onViewMore}
          />
        )),
      )}
    </div>
  )
})

const CalendarHeader = memo(function CalendarHeader({ monthLabel, onGoPrev, onGoToday, onGoNext }: CalendarHeaderProps) {
  return (
    <header className="calendarHeader">
      <div className="calendarNav">
        <button type="button" className="btn--today" onClick={onGoToday}>
          Today
        </button>

        <button type="button" className="btn btn--ghost" onClick={onGoPrev} aria-label="Previous month">
          {"<"}
        </button>

        <button type="button" className="btn btn--ghost" onClick={onGoNext} aria-label="Next month">
          {">"}
        </button>
      </div>

      <h1 className="calendarTitle">{monthLabel}</h1>
    </header>
  )
})

export default function Calendar({ allowPastEvents = true }: CalendarProps) {
  const [cursor, setCursor] = useState<CalendarCursor>(() => {
    const today = new Date()
    return {
      year: today.getFullYear(),
      monthIndex: today.getMonth(),
    }
  })
  const [events, setEvents] = useState<CalendarEvent[]>(() => loadEvents())
  const [draft, setDraft] = useState<EventDraft>(() => createEmptyDraft())
  const [formErrors, setFormErrors] = useState<EventFormErrors>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeDateKey, setActiveDateKey] = useState<DateKey | null>(null)
  const [isEditorClosing, setIsEditorClosing] = useState(false)
  const [viewMoreDateKey, setViewMoreDateKey] = useState<DateKey | null>(null)
  const [isViewMoreClosing, setIsViewMoreClosing] = useState(false)

  const editorTimerRef = useRef<number | null>(null)
  const viewMoreTimerRef = useRef<number | null>(null)

  const visibleWeeks = useMemo(() => getMonthMatrix(cursor.year, cursor.monthIndex), [cursor.monthIndex, cursor.year])
  const eventMap = useMemo(() => groupEventsByDate(events), [events])
  const currentMonthLabel = useMemo(() => formatMonthLabel(cursor.year, cursor.monthIndex), [cursor.monthIndex, cursor.year])
  const viewMoreEvents = useMemo(() => (viewMoreDateKey ? (eventMap[viewMoreDateKey] ?? []) : []), [eventMap, viewMoreDateKey])

  useEffect(() => {
    return () => {
      clearTimer(editorTimerRef)
      clearTimer(viewMoreTimerRef)
    }
  }, [])

  const commitEvents = useCallback((nextEvents: CalendarEvent[]) => {
    setEvents(nextEvents)
    saveEvents(nextEvents)
  }, [])

  const resetForm = useCallback(() => {
    setDraft(createEmptyDraft())
    setFormErrors({})
  }, [])

  const openCreateModal = useCallback(
    (dateKey: DateKey) => {
      if (!allowPastEvents && isPastDateKey(dateKey)) return

      clearTimer(editorTimerRef)
      clearTimer(viewMoreTimerRef)

      setIsEditorClosing(false)
      setIsViewMoreClosing(false)
      setViewMoreDateKey(null)
      setEditingId(null)
      setActiveDateKey(dateKey)
      resetForm()
    },
    [allowPastEvents, resetForm],
  )

  const closeEditor = useCallback(() => {
    if (!activeDateKey) return

    clearTimer(editorTimerRef)
    setIsEditorClosing(true)
    editorTimerRef.current = window.setTimeout(() => {
      setActiveDateKey(null)
      setEditingId(null)
      setIsEditorClosing(false)
      setFormErrors({})
      editorTimerRef.current = null
    }, MODAL_ANIMATION_MS)
  }, [activeDateKey])

  const openViewMore = useCallback((dateKey: DateKey) => {
    clearTimer(viewMoreTimerRef)
    setIsViewMoreClosing(false)
    setViewMoreDateKey(dateKey)
  }, [])

  const closeViewMore = useCallback(() => {
    if (!viewMoreDateKey) return

    clearTimer(viewMoreTimerRef)
    setIsViewMoreClosing(true)
    viewMoreTimerRef.current = window.setTimeout(() => {
      setViewMoreDateKey(null)
      setIsViewMoreClosing(false)
      viewMoreTimerRef.current = null
    }, MODAL_ANIMATION_MS)
  }, [viewMoreDateKey])

  const populateDraftFromEvent = useCallback((calendarEvent: CalendarEvent) => {
    clearTimer(editorTimerRef)
    setIsEditorClosing(false)
    setActiveDateKey(calendarEvent.dateKey)
    setEditingId(calendarEvent.id)
    setFormErrors({})
    setDraft({
      name: calendarEvent.name,
      allDay: calendarEvent.allDay,
      startTime: calendarEvent.allDay ? DEFAULT_START_TIME : calendarEvent.startTime,
      endTime: calendarEvent.allDay ? DEFAULT_END_TIME : calendarEvent.endTime,
      color: calendarEvent.color,
    })
  }, [])

  const openEditEvent = useCallback(
    (calendarEvent: CalendarEvent) => {
      const startEditing = () => {
        setViewMoreDateKey(null)
        setIsViewMoreClosing(false)
        populateDraftFromEvent(calendarEvent)
      }

      if (viewMoreDateKey) {
        clearTimer(viewMoreTimerRef)
        setIsViewMoreClosing(true)
        viewMoreTimerRef.current = window.setTimeout(() => {
          startEditing()
          viewMoreTimerRef.current = null
        }, MODAL_ANIMATION_MS)
        return
      }

      startEditing()
    },
    [populateDraftFromEvent, viewMoreDateKey],
  )

  const updateDraft = useCallback((patch: Partial<EventDraft>) => {
    setDraft((currentDraft) => ({ ...currentDraft, ...patch }))
    setFormErrors((currentErrors) => {
      const nextErrors = { ...currentErrors }

      if ("name" in patch) {
        delete nextErrors.name
      }

      if ("allDay" in patch || "startTime" in patch || "endTime" in patch) {
        delete nextErrors.time
      }

      return nextErrors
    })
  }, [])

  const validateDraft = useCallback((): EventFormErrors => {
    const nextErrors: EventFormErrors = {}

    if (!draft.name.trim()) {
      nextErrors.name = "Event name is required."
    }

    if (!draft.allDay && draft.startTime >= draft.endTime) {
      nextErrors.time = "End time must be later than start time."
    }

    return nextErrors
  }, [draft])

  const saveEvent = useCallback(() => {
    if (!activeDateKey) return

    const nextErrors = validateDraft()
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      return
    }

    const trimmedName = draft.name.trim()
    const nextEvent: CalendarEvent = draft.allDay
      ? {
          id: editingId ?? crypto.randomUUID(),
          name: trimmedName,
          dateKey: activeDateKey,
          color: draft.color,
          allDay: true,
        }
      : {
          id: editingId ?? crypto.randomUUID(),
          name: trimmedName,
          dateKey: activeDateKey,
          color: draft.color,
          allDay: false,
          startTime: draft.startTime,
          endTime: draft.endTime,
        }

    const nextEvents = editingId ? events.map((calendarEvent) => (calendarEvent.id === editingId ? nextEvent : calendarEvent)) : [...events, nextEvent]

    commitEvents(nextEvents)
    closeEditor()
  }, [activeDateKey, closeEditor, commitEvents, draft, editingId, events, validateDraft])

  const deleteEvent = useCallback(() => {
    if (!editingId) return

    const nextEvents = events.filter((calendarEvent) => calendarEvent.id !== editingId)
    commitEvents(nextEvents)
    closeEditor()
  }, [closeEditor, commitEvents, editingId, events])

  const goPrev = useCallback(() => {
    setCursor((currentCursor) => addMonths(currentCursor.year, currentCursor.monthIndex, -1))
  }, [])

  const goToday = useCallback(() => {
    const today = new Date()
    setCursor({
      year: today.getFullYear(),
      monthIndex: today.getMonth(),
    })
  }, [])

  const goNext = useCallback(() => {
    setCursor((currentCursor) => addMonths(currentCursor.year, currentCursor.monthIndex, 1))
  }, [])

  return (
    <section className="appShell">
      <CalendarHeader monthLabel={currentMonthLabel} onGoPrev={goPrev} onGoToday={goToday} onGoNext={goNext} />

      <CalendarGrid visibleWeeks={visibleWeeks} eventMap={eventMap} allowPastEvents={allowPastEvents} onAddEvent={openCreateModal} onEditEvent={openEditEvent} onViewMore={openViewMore} />

      {viewMoreDateKey && <ViewMoreModal dateKey={viewMoreDateKey} dayEvents={viewMoreEvents} isClosing={isViewMoreClosing} onEditEvent={openEditEvent} onClose={closeViewMore} />}

      {activeDateKey && (
        <EventModal
          dateKey={activeDateKey}
          draft={draft}
          errors={formErrors}
          isClosing={isEditorClosing}
          isEditing={editingId !== null}
          onDraftChange={updateDraft}
          onSave={saveEvent}
          onDelete={deleteEvent}
          onClose={closeEditor}
        />
      )}
    </section>
  )
}
