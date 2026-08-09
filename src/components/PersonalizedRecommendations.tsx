import { Link } from "react-router-dom";
import type { TmdbItem } from "../types/types";
import type { GenrePreference } from "../utils/recommendations";
import Card from "./Card";
import { Icon } from "./ui/Icon";
import "../css/personalizedRecommendations.css";

export default function PersonalizedRecommendations({
  items,
  profile,
  historyCount,
  onSelect,
}: {
  items: TmdbItem[];
  profile: GenrePreference[];
  historyCount: number;
  onSelect: (item: TmdbItem) => void;
}) {
  const hasProfile = profile.length > 0;

  return (
    <main className="recommendations-page">
      <header className="recommendations-hero">
        <div className="recommendations-kicker"><Icon name="sparkles" size={16} /> Profilo di visione SFA</div>
        <h1>Scelti <span>per te</span></h1>
        <p>
          {hasProfile
            ? `Questa selezione nasce da ${historyCount} titoli guardati o iniziati. I generi più frequenti e i voti più alti pesano maggiormente.`
            : "La selezione parte dai titoli più apprezzati. Guardando e valutando contenuti diventerà sempre più personale."}
        </p>
        <Link to="/" className="recommendations-back"><Icon name="chevron-left" size={17} /> Torna alla home</Link>
      </header>

      <section className="taste-profile" aria-label="Distribuzione dei generi preferiti">
        <div>
          <span>Il tuo DNA cinematografico</span>
          <h2>{hasProfile ? `${profile[0].label} guida la selezione` : "Il profilo si costruisce mentre guardi"}</h2>
        </div>
        <div className="taste-bars">
          {profile.slice(0, 6).map((genre) => (
            <div className="taste-row" key={genre.key}>
              <span>{genre.label}</span>
              <div><i style={{ width: `${genre.percentage}%` }} /></div>
              <strong>{genre.percentage}%</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="recommendations-catalog">
        <div className="recommendations-catalog-heading">
          <h2>{items.length} titoli selezionati</h2>
          <p>Film e serie sono mescolati rispettando il tuo equilibrio di visione.</p>
        </div>
        {items.length > 0 ? (
          <div className="recommendations-grid">
            {items.map((item) => (
              <Card key={`${item.type}:${item.tmdbId}`} item={item} onClick={() => onSelect(item)} />
            ))}
          </div>
        ) : (
          <div className="recommendations-empty">Stiamo preparando i tuoi consigli.</div>
        )}
      </section>
    </main>
  );
}
