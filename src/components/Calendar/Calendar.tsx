import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { CalendarEvent, DateKey, EventColor } from "../../types/calendar"
import { addMonths, getMonthMatrix, isPastDateKey, isTodayDateKey } from "../../utils/dateGrid"
import { loadEvents, saveEvents } from "../../utils/storage"

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const COLOR_OPTIONS: EventColor[] = ["red", "green", "blue"]

function swatchColor(value: EventColor): string {
  if (value === "red") return "var(--event-red)"
  if (value === "blue") return "var(--event-blue)"
  return "var(--event-green)"
}

function formatModalDate(dateKey: DateKey | null): string {
  if (!dateKey) return ""
  const [year, month, day] = dateKey.split("-")
  return `${Number(month)}/${Number(day)}/${year.slice(-2)}`
}

export default function Calendar() {
  const today = new Date()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    monthIndex: today.getMonth(),
  })

  const [events, setEvents] = useState<CalendarEvent[]>(() => loadEvents())
  const [isClosing, setIsClosing] = useState(false)
  const [isViewMoreClosing, setIsViewMoreClosing] = useState(false)
  const [activeDateKey, setActiveDateKey] = useState<DateKey | null>(null)
  const [viewMoreDateKey, setViewMoreDateKey] = useState<DateKey | null>(null)
  const [name, setName] = useState("")
  const [allDay, setAllDay] = useState(true)
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("10:00")
  const [color, setColor] = useState<EventColor>("blue")
  const cellRefs = useRef(new Map<DateKey, HTMLDivElement>())
  const [maxVisibleDate, setMaxVisibleDate] = useState<Record<DateKey, number>>({})

  const matrix = getMonthMatrix(cursor.year, cursor.monthIndex)

  function goPrev() {
    setCursor(addMonths(cursor.year, cursor.monthIndex, -1))
  }

  function goToday() {
    const t = new Date()
    setCursor({ year: t.getFullYear(), monthIndex: t.getMonth() })
  }

  function goNext() {
    setCursor(addMonths(cursor.year, cursor.monthIndex, 1))
  }

  function monthLabel(year: number, monthIndex: number) {
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, monthIndex, 1))
  }

  function openModal(dateKey: DateKey) {
    setIsViewMoreClosing(false)
    setViewMoreDateKey(null)
    setEditingId(null)
    setActiveDateKey(dateKey)
    setName("")
    setAllDay(true)
    setStartTime("09:00")
    setEndTime("10:00")
    setColor("blue")
  }

  function closeModal() {
    setIsClosing(true)
    window.setTimeout(() => {
      setActiveDateKey(null)
      setEditingId(null)
      setIsClosing(false)
    }, 200)
  }

  function openViewMore(dateKey: DateKey) {
    setIsViewMoreClosing(false)
    setViewMoreDateKey(dateKey)
  }

  function closeViewMore() {
    setIsViewMoreClosing(true)
    window.setTimeout(() => {
      setViewMoreDateKey(null)
      setIsViewMoreClosing(false)
    }, 200)
  }

  function openEditFromEvent(ev: CalendarEvent) {
    const openEditor = () => {
      setActiveDateKey(ev.dateKey)
      setEditingId(ev.id)
      setName(ev.name)
      setColor(ev.color)
      setAllDay(ev.allDay)
    }

    if (!ev.allDay) {
      setStartTime(ev.startTime)
      setEndTime(ev.endTime)
    } else {
      setStartTime("09:00")
      setEndTime("10:00")
    }

    if (viewMoreDateKey) {
      setIsViewMoreClosing(true)
      window.setTimeout(() => {
        setViewMoreDateKey(null)
        setIsViewMoreClosing(false)
        openEditor()
      }, 200)
      return
    }

    openEditor()
  }

  const computeMaxVisibleForCell = useCallback((cellEl: HTMLDivElement): number => {
    const cellHeight = cellEl.clientHeight

    const paddingTopBottom = 16
    const headerBlock = 44
    const marginTopEvents = 8

    const available = cellHeight - paddingTopBottom - headerBlock - marginTopEvents

    const pillHeight = 18
    const gap = 4
    const rowHeight = pillHeight + gap

    const raw = Math.floor(available / rowHeight)

    return Math.max(0, Math.min(raw, 10))
  }, [])

  function save() {
    if (!activeDateKey) return
    if (!name.trim()) return

    if (!allDay && startTime >= endTime) return

    let newEvent: CalendarEvent

    if (allDay) {
      newEvent = {
        id: crypto.randomUUID(),
        name: name.trim(),
        dateKey: activeDateKey,
        color,
        allDay: true,
      }
    } else {
      newEvent = {
        id: crypto.randomUUID(),
        name: name.trim(),
        dateKey: activeDateKey,
        color,
        allDay: false,
        startTime,
        endTime,
      }
    }

    const next = editingId ? events.map((e) => (e.id === editingId ? { ...newEvent, id: editingId } : e)) : [...events, newEvent]
    setEvents(next)
    saveEvents(next)
    closeModal()
    setEditingId(null)
  }

  const recalcMaxVisible = useCallback(() => {
    const next: Record<DateKey, number> = {}
    cellRefs.current.forEach((el, dateKey) => {
      if (!el) return
      next[dateKey] = computeMaxVisibleForCell(el)
    })
    setMaxVisibleDate(next)
  }, [computeMaxVisibleForCell])

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      recalcMaxVisible()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [recalcMaxVisible, events, cursor.year, cursor.monthIndex])

  useEffect(() => {
    const onResize = () => recalcMaxVisible()
    window.requestAnimationFrame(() => {
      recalcMaxVisible()
    })
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [recalcMaxVisible])

  return (
    <div className="appShell" style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 16px 18px", borderBottom: "1px solid var(--btn-border)" }}>
        <button className="btn btn-today" onClick={goToday}>
          Today
        </button>

        <button className="btn" onClick={goPrev} style={{ border: "white", background: "white" }}>
          {"<"}
        </button>

        <button className="btn" onClick={goNext} style={{ border: "white", background: "white" }}>
          {">"}
        </button>

        <h1 style={{ margin: 0, fontFamily: "sans-serif", fontSize: 28, fontWeight: 600 }}>{monthLabel(cursor.year, cursor.monthIndex)}</h1>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gridTemplateRows: `repeat(${matrix.length}, minmax(0, 1fr))`,
          gap: 0,
          minHeight: 0,
          borderLeft: "1px solid var(--btn-border)",
        }}
      >
        {matrix.flat().map((cell, i) => {
          const row = Math.floor(i / 7)
          const column = i % 7
          const weekday = WEEK_DAYS[column]
          const isToday = isTodayDateKey(cell.dateKey)
          const isPast = isPastDateKey(cell.dateKey)

          const dayEvents = events.filter((e) => e.dateKey === cell.dateKey)

          dayEvents.sort((a, b) => {
            if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
            const aKey = a.allDay ? "" : a.startTime
            const bKey = b.allDay ? "" : b.startTime
            return aKey.localeCompare(bKey)
          })

          const rawMax = maxVisibleDate[cell.dateKey] ?? 3
          const boundedMax = Math.max(1, Math.min(rawMax, 2))
          const maxVisible = Math.min(dayEvents.length, boundedMax)
          const visible = dayEvents.slice(0, maxVisible)
          const overflow = dayEvents.length - visible.length

          return (
            <div
              key={cell.dateKey}
              ref={(el) => {
                if (!el) {
                  cellRefs.current.delete(cell.dateKey)
                  return
                }
                cellRefs.current.set(cell.dateKey, el)
              }}
              className="dayCell"
              style={{
                position: "relative",
                minHeight: 0,
                fontFamily: "sans-serif",
                borderTop: "1px solid var(--btn-border)",
                borderRight: "1px solid var(--btn-border)",
                padding: 8,
                background: cell.inMonth ? "#fff" : "var(--out-of-month-bg)",
                opacity: isPast ? 0.45 : 1,
              }}
            >
              <div style={{ display: "grid", justifyItems: "center", gap: 2 }}>
                {row === 0 && <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: "var(--text-week-name)" }}>{weekday.toUpperCase()}</div>}

                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    background: isToday ? "var(--text-today-bg)" : "transparent",
                    color: isToday ? "var(--text-today)" : "inherit",
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  {cell.dateKey.slice(-2)}
                </div>
              </div>

              <button
                className="btn addBtn"
                onClick={() => openModal(cell.dateKey)}
                disabled={isPast}
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  width: 26,
                  height: 26,
                  padding: 0,
                  border: "white",
                  background: "transparent",
                  fontSize: 18,
                  display: "grid",
                  placeItems: "center",
                  lineHeight: 1,
                  cursor: isPast ? "not-allowed" : "pointer",
                }}
                aria-label={`Add event on ${cell.dateKey}`}
              >
                +
              </button>

              <div style={{ display: "grid", gap: 4, marginTop: 8, textAlign: "left" }}>
                {visible.map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      fontSize: 12,
                      padding: "2px 6px",
                      borderRadius: 6,
                      background: ev.color === "red" ? "var(--event-red)" : ev.color === "blue" ? "var(--event-blue)" : "var(--event-green)",
                      color: "white",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                    }}
                    title={ev.name}
                    onClick={() => openEditFromEvent(ev)}
                  >
                    {ev.allDay ? ev.name : `${ev.startTime} ${ev.name}`}
                  </div>
                ))}

                {overflow > 0 && (
                  <button className="btn" style={{ fontSize: 12, padding: "2px 6px", border: "white", background: "white", cursor: "pointer" }} onClick={() => openViewMore(cell.dateKey)}>
                    +{overflow} more
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {(viewMoreDateKey || isViewMoreClosing) && (
        <div
          className={`modalBackDrop ${isViewMoreClosing ? "out" : "in"}`}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
          onClick={closeViewMore}
        >
          <div
            className={`modalCard ${isViewMoreClosing ? "out" : "in"}`}
            style={{ background: "#fff", borderRadius: 12, padding: 16, width: "min(350px, 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, fontFamily: "sans-serif", color: "var(--modal-date-header)" }}>
              {formatModalDate(viewMoreDateKey)}
              <button className="btn" style={{ border: "white", background: "white", cursor: "pointer", fontSize: "20px" }} onClick={closeViewMore}>
                {"\u00D7"}
              </button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {events
                .filter((e) => e.dateKey === viewMoreDateKey)
                .sort((a, b) => {
                  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
                  const aKey = a.allDay ? "" : a.startTime
                  const bKey = b.allDay ? "" : b.startTime
                  return aKey.localeCompare(bKey)
                })
                .map((ev) => (
                  <button
                    key={ev.id}
                    className="btn"
                    style={{
                      textAlign: "left",
                      border: "transparent",
                      background: "#fff",
                      padding: "0px 10px",
                      borderRadius: 10,
                      cursor: "pointer",
                    }}
                    onClick={() => openEditFromEvent(ev)}
                    title={ev.name}
                  >
                    <div
                      style={{
                        fontFamily: "sans-serif",
                        fontSize: 12,
                        background: swatchColor(ev.color),
                        padding: "3px 8px",
                        border: "transparent",
                        borderRadius: 6,
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ev.allDay ? ev.name : `${ev.startTime} - ${ev.endTime}  ${ev.name}`}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {(activeDateKey || isClosing) && (
        <div
          className={`modalBackDrop ${isClosing ? "out" : "in"}`}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
          onClick={closeModal}
        >
          <div className={`modalCard ${isClosing ? "out" : "in"}`} style={{ background: "#fff", borderRadius: 8, padding: 20, width: "340px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "5px 5px 10px", display: "flex", justifyContent: "space-between", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 10, fontFamily: "sans-serif" }}>
              <strong style={{ fontSize: 25, lineHeight: 1 }}>{editingId ? "Edit Event" : "Add Event"}</strong>
              <span style={{ color: "var(--modal-date-header)", paddingRight: "25px", fontSize: 20 }}>{formatModalDate(activeDateKey)}</span>
              <button
                type="button"
                className="btn"
                aria-label="Close"
                style={{ border: "none", cursor: "pointer", fontSize: 23, padding: 0, width: 24, height: 24, lineHeight: 1 }}
                onClick={closeModal}
              >
                {"\u00D7"}
              </button>
            </div>
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <label style={{ display: "grid", gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "sans-serif", color: "var(--modal-form-label)" }}>Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ height: 28, padding: "0 6px", border: "1px solid #c7c7c7", borderRadius: 3, fontFamily: "sans-serif", fontSize: 13 }}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "sans-serif" }}>
                <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} style={{ margin: 0 }} />
                <span style={{ fontSize: 12 }}>All Day?</span>
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <label style={{ display: "grid", gap: 2 }}>
                  <span style={{ fontFamily: "sans-serif", fontSize: 11, fontWeight: 600, color: "var(--modal-form-label)" }}>Start Time</span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    disabled={allDay}
                    style={{ height: 28, padding: "0 6px", border: "1px solid #c7c7c7", borderRadius: 0, fontFamily: "sans-serif", fontSize: 13, opacity: allDay ? 0.55 : 1 }}
                  />
                </label>

                <label style={{ display: "grid", gap: 2 }}>
                  <span style={{ fontFamily: "sans-serif", fontSize: 11, fontWeight: 600, color: "var(--modal-form-label)" }}>End Time</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    disabled={allDay}
                    style={{ height: 28, padding: "0 6px", border: "1px solid #c7c7c7", borderRadius: 0, fontFamily: "sans-serif", fontSize: 13, opacity: allDay ? 0.55 : 1 }}
                  />
                </label>
              </div>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontFamily: "sans-serif", fontSize: 11, fontWeight: 600, color: "var(--modal-form-label)" }}>Color</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {COLOR_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setColor(option)}
                      aria-label={`Select ${option} color`}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 3,
                        border: color === option ? "2px solid #6b6b6b" : "1px solid #d6d6d6",
                        background: swatchColor(option),
                        cursor: "pointer",
                        padding: 0,
                      }}
                    />
                  ))}
                </div>
              </label>

              <button
                className="btn"
                onClick={save}
                style={{
                  width: "100%",
                  height: 30,
                  border: "1px solid var(--save-or-add-btn-border)",
                  background: "var(--save-or-add-btn-bg)",
                  color: "var(--save-or-add-btn-text)",
                  cursor: "pointer",
                  padding: 0,
                  borderRadius: 4,
                }}
              >
                {editingId ? "Save" : "Add"}
              </button>
              {editingId && (
                <button
                  className="btn"
                  style={{ border: "1px solid var(--delete-btn-border)", background: "var(--delete-btn-bg)", color: "var(--delete-btn-text)", cursor: "pointer" }}
                  onClick={() => {
                    const next = events.filter((e) => e.id !== editingId)
                    setEvents(next)
                    saveEvents(next)
                    closeModal()
                    setEditingId(null)
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
