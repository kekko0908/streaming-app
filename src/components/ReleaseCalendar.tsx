import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { motion } from "framer-motion";
import { SavedItem, TmdbItem } from "../types/types";
import { Icon } from "./ui/Icon";
import { getDateKey } from "../utils/release";
import "../css/releaseCalendar.css";

type CalendarMode = "day" | "week" | "month";

type ReleaseEvent = {
  id: string;
  date: string;
  kind: "movie" | "episode";
  title: string;
  subtitle: string;
  meta: string;
  genres: string;
  description: string;
  provenance: string;
  poster: string;
  item: TmdbItem;
};

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

function buildEvents(upcoming: TmdbItem[], myList: SavedItem[]) {
  const events = new Map<string, ReleaseEvent>();
  const todayKey = getDateKey();

  upcoming.forEach((item) => {
    const releaseDate = item.releaseInfo?.date;
    if (!releaseDate || item.releaseInfo?.verification !== "verified_it" || item.releaseInfo.kind !== "digital" || releaseDate < todayKey) return;
    const id = `movie-${item.tmdbId}-${releaseDate}`;
    events.set(id, {
      id,
      date: releaseDate,
      kind: "movie",
      title: item.title,
      subtitle: "Film",
      meta: "",
      genres: item.genres?.slice(0, 2).join(", ") || "Fantascienza, Avventura",
      description: item.overview || "Disponibile in uscita.",
      provenance: "Uscita digitale Italia · verificata TMDB",
      poster: item.poster,
      item,
    });
  });

  myList.forEach((item) => {
    const episode = item.nextEpisodeToAir;
    if (!episode?.air_date || episode.air_date < todayKey) return;
    const id = `episode-${item.tmdbId}-${episode.air_date}-${episode.season_number || 0}-${episode.episode_number}`;
    events.set(id, {
      id,
      date: episode.air_date,
      kind: "episode",
      title: item.title,
      subtitle: "Nuovo episodio",
      meta: `S${episode.season_number || 1} • Ep. ${episode.episode_number}`,
      genres: item.genres?.slice(0, 2).join(", ") || "Fantasy, Mistero",
      description: episode.overview || item.overview || "Nuovo episodio in arrivo.",
      provenance: "Messa in onda originale · TMDB",
      poster: item.poster,
      item,
    });
  });

  return Array.from(events.values()).sort((a, b) => a.date.localeCompare(b.date));
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

function EventChip({ event, compact, onSelect }: { event: ReleaseEvent; compact?: boolean; onSelect: (item: TmdbItem) => void }) {
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

  const events = useMemo(() => buildEvents(upcoming, myList), [upcoming, myList]);
  const eventsByDay = useMemo(() => events.reduce<Record<string, ReleaseEvent[]>>((acc, event) => {
    acc[event.date] = [...(acc[event.date] || []), event];
    return acc;
  }, {}), [events]);

  const visibleDays = useMemo(() => getVisibleDays(anchorDate, mode), [anchorDate, mode]);
  const selectedEvents = eventsByDay[selectedDateKey] || [];
  const selectedDate = parseDateKey(selectedDateKey);
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
          <p>Film con uscita digitale italiana verificata ed episodi delle serie che segui.</p>
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
            <p>I film usano la data digitale italiana; gli episodi indicano la messa in onda originale.</p>
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
