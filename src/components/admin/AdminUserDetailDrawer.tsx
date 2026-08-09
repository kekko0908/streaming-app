import { AdminSuggestionSummary, AdminUserDetail } from "../../types/types";
import { formatDate, formatDateTime, formatHours } from "./adminFormat";

export function AdminUserDetailDrawer({
  selectedUserId,
  selectedUser,
  detailLoading,
  detailError,
  busyRoleIds,
  busySuggestionIds,
  onClose,
  onToggleAdmin,
  onDeleteSuggestion,
}: {
  selectedUserId: string | null;
  selectedUser: AdminUserDetail | null;
  detailLoading: boolean;
  detailError: string;
  busyRoleIds: string[];
  busySuggestionIds: number[];
  onClose: () => void;
  onToggleAdmin: (user: AdminUserDetail) => void;
  onDeleteSuggestion: (suggestion: AdminSuggestionSummary) => void;
}) {
  return (
    <aside className={`admin-detail-drawer ${selectedUserId ? "is-open" : ""}`}>
      <div className="admin-detail-header">
        <div>
          <span>Dettaglio utente</span>
          <h3>{selectedUser?.username || "Seleziona un utente"}</h3>
        </div>
        {selectedUserId && (
          <button className="pill ghost" onClick={onClose}>
            Chiudi
          </button>
        )}
      </div>

      {!selectedUserId ? (
        <div className="admin-empty-inline">Apri un utente dalla tabella per vedere il pannello completo.</div>
      ) : detailLoading ? (
        <div className="admin-loading">Caricamento dettaglio...</div>
      ) : detailError ? (
        <div className="admin-error">{detailError}</div>
      ) : selectedUser && (
        <div className="admin-detail-body">
          <div className="admin-detail-identity">
            <img src={selectedUser.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Admin"} alt={selectedUser.username} />
            <div>
              <strong>{selectedUser.username}</strong>
              <span>{selectedUser.email}</span>
              <small>Creato il {formatDate(selectedUser.createdAt)}</small>
            </div>
          </div>

          <div className="admin-detail-role">
            <span className={`admin-role-badge ${selectedUser.isAdmin ? "is-admin" : ""}`}>
              {selectedUser.isAdmin ? "Admin attivo" : "Utente standard"}
            </span>
            <button
              className={`pill ${selectedUser.isAdmin ? "ghost" : "solid"}`}
              onClick={() => onToggleAdmin(selectedUser)}
              disabled={busyRoleIds.includes(selectedUser.id)}
            >
              {busyRoleIds.includes(selectedUser.id)
                ? "Aggiorno..."
                : selectedUser.isAdmin
                  ? "Rimuovi admin"
                  : "Promuovi admin"}
            </button>
          </div>

          <div className="admin-detail-kpis">
            <article>
              <span>Titoli</span>
              <strong>{selectedUser.libraryCount}</strong>
            </article>
            <article>
              <span>Media voti</span>
              <strong>{selectedUser.averageRating.toFixed(1)}</strong>
            </article>
            <article>
              <span>Tempo visto</span>
              <strong>{formatHours(selectedUser.totalMinutes)}</strong>
            </article>
          </div>

          <section className="admin-detail-section">
            <h4>Stato libreria</h4>
            <div className="admin-status-grid">
              <article>
                <span>In corso</span>
                <strong>{selectedUser.statusBreakdown["in-corso"] || 0}</strong>
              </article>
              <article>
                <span>Da guardare</span>
                <strong>{selectedUser.statusBreakdown["da-guardare"] || 0}</strong>
              </article>
              <article>
                <span>Già guardato</span>
                <strong>{selectedUser.statusBreakdown["gia-guardato"] || 0}</strong>
              </article>
            </div>
          </section>

          <section className="admin-detail-section">
            <h4>Ultimi suggerimenti</h4>
            {selectedUser.recentSuggestions.length === 0 ? (
              <div className="admin-empty-inline">Nessun suggerimento pubblicato.</div>
            ) : (
              <div className="admin-mini-list">
                {selectedUser.recentSuggestions.map((suggestion) => (
                  <article key={suggestion.id} className="admin-mini-card">
                    <div>
                      <strong>{suggestion.title}</strong>
                      <span>{formatDateTime(suggestion.createdAt)}</span>
                      <p>{suggestion.comment || "Nessun commento inserito."}</p>
                    </div>
                    <button
                      className="pill ghost"
                      onClick={() => onDeleteSuggestion(suggestion)}
                      disabled={busySuggestionIds.includes(suggestion.id)}
                    >
                      Elimina
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="admin-detail-section">
            <h4>Ultimi titoli in libreria</h4>
            {selectedUser.recentLibrary.length === 0 ? (
              <div className="admin-empty-inline">Libreria vuota.</div>
            ) : (
              <div className="admin-mini-list">
                {selectedUser.recentLibrary.map((item) => (
                  <article key={`${selectedUser.id}-${item.tmdbId}-${item.status}`} className="admin-mini-card compact">
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.mediaType === "tv" ? "Serie TV" : "Film"} - {item.status}</span>
                    </div>
                    <span className="admin-rating-chip">{item.rating > 0 ? item.rating.toFixed(1) : "No voto"}</span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}
