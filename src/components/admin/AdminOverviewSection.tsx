import { AdminOverview, AdminSuggestionSummary } from "../../types/types";
import { formatDateTime } from "./adminFormat";

function CommunityList({
  title,
  items,
  variant,
}: {
  title: string;
  items: AdminOverview["topWatched"];
  variant: "watched" | "loved" | "completed";
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <h3>{title}</h3>
      </div>
      <div className="admin-community-list">
        {items.length === 0 ? (
          <div className="admin-empty-inline">Nessun dato disponibile.</div>
        ) : (
          items.map((item, index) => (
            <article key={`${variant}-${item.tmdbId}`} className="admin-community-card">
              <div className="admin-community-rank">#{index + 1}</div>
              <img src={item.poster || "https://via.placeholder.com/120x180"} alt={item.title} />
              <div>
                <strong>{item.title}</strong>
                <span>{item.mediaType === "tv" ? "Serie TV" : "Film"}</span>
                {variant === "watched" && <p>{item.watchedCount || 0} utenti lo hanno visto.</p>}
                {variant === "completed" && <p>{item.completedCount || 0} completamenti registrati.</p>}
                {variant === "loved" && (
                  <p>
                    Score {(item.communityScore || 0).toFixed(1)} - voto {(item.communityRating || 0).toFixed(1)}
                  </p>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export function AdminOverviewSection({
  overview,
  loading,
  error,
  busySuggestionIds,
  onDeleteSuggestion,
}: {
  overview: AdminOverview | null;
  loading: boolean;
  error: string;
  busySuggestionIds: number[];
  onDeleteSuggestion: (suggestion: AdminSuggestionSummary) => void;
}) {
  if (loading) return <div className="admin-loading">Caricamento overview admin...</div>;
  if (error) return <div className="admin-error">{error}</div>;
  if (!overview) return null;

  return (
    <>
      <section className="admin-kpi-grid">
        <article className="admin-kpi-card">
          <span>Utenti registrati</span>
          <strong>{overview.totalUsers}</strong>
          <p>Nuovi 7 giorni: {overview.newUsers7d}</p>
        </article>
        <article className="admin-kpi-card">
          <span>Librerie attive</span>
          <strong>{overview.activeLibraryUsers}</strong>
          <p>Utenti con almeno un titolo salvato.</p>
        </article>
        <article className="admin-kpi-card">
          <span>Titoli salvati</span>
          <strong>{overview.titlesSavedTotal}</strong>
          <p>Film: {overview.movieLibraryEntries} - Serie: {overview.tvLibraryEntries}</p>
        </article>
        <article className="admin-kpi-card">
          <span>Voti espressi</span>
          <strong>{overview.ratingsTotal}</strong>
          <p>Valutazioni maggiori di 0 registrate in libreria.</p>
        </article>
        <article className="admin-kpi-card">
          <span>Suggerimenti</span>
          <strong>{overview.suggestionsTotal}</strong>
          <p>Pubblicazioni community complessive.</p>
        </article>
      </section>

      <section className="admin-overview-grid">
        <CommunityList title="Più visti" items={overview.topWatched} variant="watched" />
        <CommunityList title="Più amati" items={overview.topLoved} variant="loved" />
        <CommunityList title="Più completati" items={overview.topCompleted} variant="completed" />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h3>Ultimi suggerimenti community</h3>
        </div>
        {overview.recentSuggestions.length === 0 ? (
          <div className="admin-empty-inline">Nessun suggerimento recente.</div>
        ) : (
          <div className="admin-suggestions-list">
            {overview.recentSuggestions.map((suggestion) => (
              <article key={suggestion.id} className="admin-suggestion-card">
                <img src={suggestion.poster || "https://via.placeholder.com/120x180"} alt={suggestion.title} />
                <div className="admin-suggestion-copy">
                  <strong>{suggestion.title}</strong>
                  <span>{suggestion.userName || "Utente"} - {formatDateTime(suggestion.createdAt)}</span>
                  <p>{suggestion.comment || "Nessun commento inserito."}</p>
                </div>
                <button
                  className="pill ghost"
                  onClick={() => onDeleteSuggestion(suggestion)}
                  disabled={busySuggestionIds.includes(suggestion.id)}
                >
                  {busySuggestionIds.includes(suggestion.id) ? "Elimino..." : "Elimina"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
