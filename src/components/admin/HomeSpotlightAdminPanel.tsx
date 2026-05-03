import { MediaType, TmdbItem } from "../../types/types";

export function HomeSpotlightAdminPanel({
  spotlightItem,
  spotlightType,
  spotlightQuery,
  spotlightResults,
  spotlightLoading,
  spotlightSaving,
  spotlightMessage,
  onClearSpotlight,
  onSearch,
  onSelectSpotlight,
  onSpotlightTypeChange,
  onSpotlightQueryChange,
}: {
  spotlightItem: TmdbItem | null;
  spotlightType: MediaType;
  spotlightQuery: string;
  spotlightResults: TmdbItem[];
  spotlightLoading: boolean;
  spotlightSaving: boolean;
  spotlightMessage: string;
  onClearSpotlight: () => void;
  onSearch: () => void;
  onSelectSpotlight: (item: TmdbItem) => void;
  onSpotlightTypeChange: (type: MediaType) => void;
  onSpotlightQueryChange: (query: string) => void;
}) {
  return (
    <section className="admin-panel admin-spotlight-panel">
      <div className="admin-panel-header">
        <div>
          <h3>Titolo selezionato in home</h3>
          <p>Decidi quale film o serie mostrare nello spotlight principale della homepage.</p>
        </div>
        {spotlightItem && (
          <button className="pill ghost" onClick={onClearSpotlight} disabled={spotlightSaving}>
            Usa automatico
          </button>
        )}
      </div>

      <div className="admin-spotlight-layout">
        <article className="admin-spotlight-current">
          {spotlightLoading && !spotlightItem ? (
            <div className="admin-loading">Caricamento titolo selezionato...</div>
          ) : spotlightItem ? (
            <>
              <img src={spotlightItem.poster || spotlightItem.backdrop || "https://via.placeholder.com/120x180"} alt={spotlightItem.title} />
              <div>
                <span className="admin-eyebrow">In evidenza ora</span>
                <h4>{spotlightItem.title}</h4>
                <p>{spotlightItem.year || "N/D"} - {spotlightItem.type === "movie" ? "Film" : "Serie TV"}</p>
                <small>{spotlightItem.overview || "Nessuna trama disponibile."}</small>
              </div>
            </>
          ) : (
            <div className="admin-empty-inline">Nessun titolo fissato: la home sceglie automaticamente dai titoli del momento.</div>
          )}
        </article>

        <div className="admin-spotlight-tools">
          <div className="admin-spotlight-search">
            <select
              className="admin-search"
              value={spotlightType}
              onChange={(event) => onSpotlightTypeChange(event.target.value as MediaType)}
            >
              <option value="movie">Film</option>
              <option value="tv">Serie TV</option>
            </select>
            <input
              className="admin-search"
              placeholder="Cerca titolo TMDb..."
              value={spotlightQuery}
              onChange={(event) => onSpotlightQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSearch();
              }}
            />
            <button className="pill solid" onClick={onSearch} disabled={spotlightLoading || spotlightSaving}>
              Cerca
            </button>
          </div>

          {spotlightMessage && <div className="admin-spotlight-message">{spotlightMessage}</div>}

          {spotlightResults.length > 0 && (
            <div className="admin-spotlight-results">
              {spotlightResults.map((item) => (
                <button
                  key={`${item.type}-${item.tmdbId}`}
                  type="button"
                  className="admin-spotlight-result"
                  onClick={() => onSelectSpotlight(item)}
                  disabled={spotlightSaving}
                >
                  <img src={item.poster || "https://via.placeholder.com/80x120"} alt={item.title} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.year || "N/D"} - {item.type === "movie" ? "Film" : "Serie TV"}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
