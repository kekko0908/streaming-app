import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { STATUS_SECTIONS, TmdbItem, WatchStatus } from "../../types/types";
import StarRating from "../StarRating";
import { Icon } from "../ui/Icon";

function CustomStatusDropdown({
  currentStatus,
  onAddToList,
  onRemoveFromList,
}: {
  currentStatus?: WatchStatus;
  onAddToList: (status: WatchStatus) => void;
  onRemoveFromList: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const activeLabel = currentStatus ? STATUS_SECTIONS.find((status) => status.id === currentStatus)?.label : "+ Aggiungi alla lista";

  return (
    <div className="custom-dropdown-container">
      <button
        className={`circle-btn ${currentStatus ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        title={activeLabel}
      >
        {currentStatus ? <Icon name="check" size={20} /> : "+"}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="custom-dropdown-menu dropdown-below"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {STATUS_SECTIONS.map((status) => (
              <div
                key={status.id}
                className={`dropdown-item ${currentStatus === status.id ? "selected" : ""}`}
                onClick={() => {
                  onAddToList(status.id);
                  setIsOpen(false);
                }}
              >
                {currentStatus === status.id && <Icon name="check" size={14} />} {status.label}
              </div>
            ))}
            {currentStatus && (
              <div
                className="dropdown-item remove"
                onClick={() => {
                  onRemoveFromList();
                  setIsOpen(false);
                }}
              >
                <Icon name="x" size={14} /> Rimuovi dalla lista
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StarRatingDropdown({ rating, onRate }: { rating: number; onRate: (rating: number) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const handleRate = (nextRating: number) => {
    onRate(nextRating);
    window.setTimeout(() => setIsOpen(false), nextRating === 10 ? 1100 : 320);
  };

  return (
    <div className="custom-dropdown-container rating-dropdown">
      <button className="circle-btn" onClick={() => setIsOpen(!isOpen)} title="Vota">
        <Icon name="star" size={18} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="custom-dropdown-menu rating-dropdown-menu"
            initial={{ opacity: 0, x: -20, y: "-50%", scale: 0.95 }}
            animate={{ opacity: 1, x: 0, y: "-50%", scale: 1 }}
            exit={{ opacity: 0, x: -20, y: "-50%", scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <StarRating initialRating={rating} onRate={handleRate} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function HeroActions({
  item,
  progress,
  primaryLabel,
  currentListStatus,
  userRating,
  isUILocked,
  onPlay,
  onAddToList,
  onRate,
  onRemoveFromList,
  onToggleUILock,
  onClose,
}: {
  item: TmdbItem;
  progress: { season: number; episode: number };
  primaryLabel: string;
  currentListStatus?: WatchStatus;
  userRating: number;
  isUILocked: boolean;
  onPlay: (season: number, episode: number) => void;
  onAddToList: (status: WatchStatus) => void;
  onRate: (rating: number) => void;
  onRemoveFromList: () => void;
  onToggleUILock: () => void;
  onClose: () => void;
}) {
  const hasMovieResume = item.type === "movie" && Boolean(item.progressSeconds && item.progressSeconds > 15);
  const movieResumeTime = hasMovieResume
    ? `${Math.floor((item.progressSeconds || 0) / 60)}:${Math.floor((item.progressSeconds || 0) % 60).toString().padStart(2, "0")}`
    : "";

  return (
    <div className="hero-actions">
      <button className="cta netflix-play" onClick={() => onPlay(progress.season, progress.episode)}>
        {item.type === "tv" ? (
          primaryLabel
        ) : hasMovieResume ? (
          <>
            Riprendi <span className="hero-resume-time">{movieResumeTime}</span>
          </>
        ) : (
          <>
            <Icon name="play" size={18} /> Riproduci
          </>
        )}
      </button>

      <div className="circle-btn rating" title="TMDB Rating">
        {item.rating.toFixed(1)}
      </div>

      <CustomStatusDropdown currentStatus={currentListStatus} onAddToList={onAddToList} onRemoveFromList={onRemoveFromList} />
      <StarRatingDropdown rating={userRating} onRate={onRate} />

      <button
        className={`circle-btn zen-mode-btn hero-action-spacer ${isUILocked ? "active" : ""}`}
        onClick={onToggleUILock}
        title={isUILocked ? "Sblocca Interfaccia" : "Blocca Interfaccia (Zen Mode)"}
      >
        <Icon name={isUILocked ? "lock" : "unlock"} size={20} />
      </button>

      <button className="circle-btn close-btn" onClick={onClose} title="Chiudi">
        <Icon name="x" size={18} />
      </button>
    </div>
  );
}
