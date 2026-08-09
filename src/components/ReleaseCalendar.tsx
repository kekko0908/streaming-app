import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { motion } from "framer-motion";
import { SavedItem, TmdbItem } from "../types/types";
import { Icon } from "./ui/Icon";
import { fetchCalendarUpcoming, fetchDetails } from "../utils/api";
import { buildReleaseCalendarEvents, type ReleaseCalendarEvent } from "../utils/releaseCalendar";
import "../css/releaseCalendar.css";

type CalendarMode = "day" | "week" | "month";

const MONTHS = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const WEEK_DAYS = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() + (day === 0 ? -6 : 1 - day));
  return next;
}

function sameDay(a: Date, b: Date) {
  return toDateKey(a) === toDateKey(b);
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

function getVisibleDays(anchorDate: Date, mode: CalendarMode) {
  if (mode === "day") return [anchorDate];
  if (mode === "week") {
    const start = startOfWeek(anchorDate);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }

  const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const start = startOfWeek(firstOfMonth);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function getTitle(anchorDate: Date, mode: CalendarMode) {
  if (mode === "day") return formatLongDate(anchorDate);
  if (mode === "week") {
    const start = startOfWeek(anchorDate);
    const end = addDays(start, 6);
    return `${start.getDate()} ${MONTHS[start.getMonth()]} - ${end.getDate()} ${MONTHS[end.getMonth()]}`;
  }
  return `${MONTHS[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
}

function moveDate(anchorDate: Date, mode: CalendarMode, direction: -1 | 1) {
  if (mode === "day") return addDays(anchorDate, direction);
  if (mode === "week") return addDays(anchorDate, direction * 7);
  return addMonths(anchorDate, direction);
}

function EventChip({ event, compact, onSelect }: { event: ReleaseCalendarEvent; compact?: boolean; onSelect: (item: TmdbItem) => void }) {
  return (
    <span className={`calendar-event-chip ${compact ? "compact" : ""}`} onClick={(eventClick: MouseEvent<HTMLSpanElement>) => {
      eventClick.stopPropagation();
      onSelect(event.item);
    }}>
      <img src={event.poster || "https://via.placeholder.com/80x120"} alt="" />
      <span>
        <strong>{event.title}</strong>
        <small className={event.kind === "episode" ? "episode" : "movie"}>{event.subtitle}</small>
        {!compact && <em>{event.meta}</em>}
      </span>
    </span>
  );
}

export default function ReleaseCalendar({ upcoming, myList, onSelect }: { upcoming: TmdbItem[]; myList: SavedItem[]; onSelect: (item: TmdbItem) => void }) {
  const [mode, setMode] = useState<CalendarMode>("month");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [isExpanded, setIsExpanded] = useState(false);
  const [calendarMovies, setCalendarMovies] = useState<TmdbItem[]>(upcoming);
  const [calendarSeries, setCalendarSeries] = useState<SavedItem[]>(myList);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true);
  const [calendarError, setCalendarError] = useState(false);
  const didFocusFirstEvent = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadCalendarData() {
      setIsLoadingCalendar(true);
      setCalendarError(false);
      const savedSeries = myList.filter((item) => item.type === "tv");
      const missingEpisodeData = savedSeries.filter((item) => !item.nextEpisodeToAir).slice(0, 24);

      const [movieResult, seriesResults] = await Promise.all([
        fetchCalendarUpcoming("IT").catch(() => null),
        Promise.allSettled(missingEpisodeData.map((item) => fetchDetails(item.tmdbId, "tv"))),
      ]);

      if (!active) return;
      const enrichedById = new Map(
        seriesResults
          .filter((result): result is PromiseFulfilledResult<TmdbItem> => result.status === "fulfilled")
          .map((result) => [result.value.tmdbId, result.value])
      );
      setCalendarMovies(movieResult?.length ? movieResult : upcoming);
      setCalendarSeries(myList.map((item) => {
        const enriched = enrichedById.get(item.tmdbId);
        return enriched ? { ...item, ...enriched, status: item.status, addedAt: item.addedAt } : item;
      }));
      setCalendarError(movieResult === null);
      setIsLoadingCalendar(false);
    }

    loadCalendarData();
    return () => { active = false; };
  }, [myList, upcoming]);

  const events = useMemo(() => buildReleaseCalendarEvents(calendarMovies, calendarSeries), [calendarMovies, calendarSeries]);
  const eventsByDay = useMemo(() => events.reduce<Record<string, ReleaseCalendarEvent[]>>((acc, event) => {
    acc[event.date] = [...(acc[event.date] || []), event];
    return acc;
  }, {}), [events]);

  const visibleDays = useMemo(() => getVisibleDays(anchorDate, mode), [anchorDate, mode]);
  const selectedEvents = eventsByDay[selectedDateKey] || [];
  const selectedDate = parseDateKey(selectedDateKey);

  useEffect(() => {
    if (didFocusFirstEvent.current || isLoadingCalendar || events.length === 0) return;
    didFocusFirstEvent.current = true;
    const today = new Date();
    const hasEventInCurrentMonth = events.some((event) => {
      const date = parseDateKey(event.date);
      return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
    });
    if (!hasEventInCurrentMonth) {
      const firstDate = parseDateKey(events[0].date);
      setAnchorDate(firstDate);
      setSelectedDateKey(events[0].date);
    }
  }, [events, isLoadingCalendar]);
  const handleDaySelect = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setIsExpanded(false);
  };

  const changeMode = (nextMode: CalendarMode) => {
    setMode(nextMode);
    setAnchorDate(parseDateKey(selectedDateKey));
  };

  return (
    <main className="release-calendar-page">
      <section className="release-calendar-hero">
        <div>
          <h1>Calendario <span>Uscite</span></h1>
          <p>Date italiane verificate per cinema e digitale; episodi con messa in onda originale.</p>
        </div>
      </section>

      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button type="button" onClick={() => setAnchorDate(moveDate(anchorDate, mode, -1))} aria-label="Periodo precedente">
            <Icon name="chevron-left" size={22} />
          </button>
          <button type="button" className="today-button" onClick={() => {
            const today = new Date();
            setAnchorDate(today);
            setSelectedDateKey(toDateKey(today));
          }}>
            <Icon name="calendar" size={18} />
          </button>
          <h2>{getTitle(anchorDate, mode)}</h2>
          <button type="button" onClick={() => setAnchorDate(moveDate(anchorDate, mode, 1))} aria-label="Periodo successivo">
            <Icon name="chevron-right" size={22} />
          </button>
        </div>

        <div className="calendar-mode-toggle" aria-label="Vista calendario">
          {(["day", "week", "month"] as CalendarMode[]).map((item) => (
            <button key={item} type="button" className={mode === item ? "active" : ""} onClick={() => changeMode(item)}>
              {item === "day" ? "Giorno" : item === "week" ? "Settimana" : "Mese"}
            </button>
          ))}
        </div>
      </div>

      {isLoadingCalendar && <div className="calendar-data-status">Aggiornamento delle prossime uscite...</div>}
      {!isLoadingCalendar && calendarError && (
        <div className="calendar-data-status warning">TMDB non è raggiungibile: sono mostrate le date già sincronizzate.</div>
      )}

      <section className="calendar-shell">
        <div className="calendar-main-panel">
          <motion.div layout className={`calendar-grid ${mode}`}>
            {mode !== "day" && WEEK_DAYS.map((day) => <div key={day} className="calendar-weekday">{day}</div>)}
            {visibleDays.map((date) => {
              const dateKey = toDateKey(date);
              const dayEvents = eventsByDay[dateKey] || [];
              const isMuted = mode === "month" && date.getMonth() !== anchorDate.getMonth();
              const isSelected = dateKey === selectedDateKey;
              const hasEvents = dayEvents.length > 0;
              const eventLimit = mode === "month" ? 2 : 5;

              return (
                <motion.button
                  layout
                  key={dateKey}
                  type="button"
                  className={`calendar-day ${isMuted ? "muted" : ""} ${isSelected ? "selected" : ""} ${hasEvents ? "has-events" : ""}`}
                  onClick={() => handleDaySelect(dateKey)}
                >
                  <div className="calendar-day-header">
                    <span className="calendar-day-number">{date.getDate()}</span>
                    {hasEvents && <span className="event-dot" />}
                  </div>
                  {sameDay(date, new Date()) && <span className="today-dot">Oggi</span>}
                  <div className="calendar-day-events">
                    {dayEvents.slice(0, eventLimit).map((event) => (
                      <EventChip key={event.id} event={event} compact={mode === "month"} onSelect={onSelect} />
                    ))}
                    {dayEvents.length > eventLimit && <span className="more-events">+{dayEvents.length - eventLimit}</span>}
                  </div>
                </motion.button>
              );
            })}
          </motion.div>

          <div className="calendar-legend">
            <span><Icon name="film" size={17} /> Film</span>
            <span><Icon name="tv" size={17} /> Nuovo episodio</span>
            <p>Film: uscita cinema o pubblicazione digitale italiana. Serie: messa in onda originale.</p>
          </div>
        </div>

        <aside className="calendar-side-panel">
          <div className="selected-day-header">
            <Icon name="calendar" size={22} />
            <div>
              <h3>{formatLongDate(selectedDate)}</h3>
              <p>{selectedEvents.length === 1 ? "1 uscita" : `${selectedEvents.length} uscite`}</p>
            </div>
          </div>

          {selectedEvents.length > 0 ? (
            <>
              <div className="selected-release-list">
                {selectedEvents.slice(0, isExpanded ? selectedEvents.length : 2).map((event) => (
                  <article key={event.id} className="selected-release-card">
                    <img src={event.poster || "https://via.placeholder.com/160x240"} alt={event.title} />
                    <div className="release-card-content">
                      <h4>{event.title}</h4>
                      <div className="release-badges">
                        <span className={event.kind === "episode" ? "episode" : "movie"}>{event.subtitle}</span>
                        {event.meta && <strong>{event.meta}</strong>}
                      </div>
                      <em className="release-genres">{event.genres}</em>
                      <p>{event.description}</p>
                      <div className="release-availability">
                        <Icon name="clock" size={14} />
                        <span>{event.provenance}</span>
                      </div>
                      <button type="button" className="add-list-btn" onClick={() => onSelect(event.item)}>
                        <Icon name="plus" size={14} /> La mia lista
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {selectedEvents.length > 2 && !isExpanded && (
                <button type="button" className="view-all-btn" onClick={() => setIsExpanded(true)}>
                  Vedi tutte le uscite del giorno <Icon name="chevron-right" size={16} />
                </button>
              )}
            </>
          ) : (
            <div className="calendar-empty-day">
              <Icon name="calendar" size={28} />
              <h4>Nessuna uscita</h4>
              <p>Seleziona un giorno rosso o controlla le prossime uscite qui sotto.</p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
