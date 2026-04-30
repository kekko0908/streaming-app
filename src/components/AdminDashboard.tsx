import { useDeferredValue, useEffect, useState } from "react";
import {
  AdminOverview,
  AdminSuggestionSummary,
  AdminUserDetail,
  AdminUserRow,
} from "../types/types";
import {
  deleteAdminSuggestion,
  fetchAdminOverview,
  fetchAdminUserDetail,
  fetchAdminUsers,
  setAdminRole,
} from "../utils/adminApi";
import CommunityPulse from "./CommunityPulse";
import "../css/admin.css";

interface AdminDashboardProps {
  currentUserId: string;
  onAdminStateChange?: (isAdmin: boolean) => void;
}

const PAGE_SIZE = 12;

function formatDate(value?: string | null) {
  if (!value) return "N/D";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/D";
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "N/D";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/D";
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatHours(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  return `${hours}h ${minutes}m`;
}

function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="admin-section-title">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}

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

export default function AdminDashboard({ currentUserId, onAdminStateChange }: AdminDashboardProps) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [busySuggestionIds, setBusySuggestionIds] = useState<number[]>([]);
  const [busyRoleIds, setBusyRoleIds] = useState<string[]>([]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch]);

  useEffect(() => {
    let isActive = true;

    async function loadOverview() {
      setOverviewLoading(true);
      setOverviewError("");
      const result = await fetchAdminOverview();
      if (!isActive) return;

      if (!result.ok || !result.data) {
        setOverview(null);
        setOverviewError(result.error || "Impossibile caricare la panoramica admin.");
      } else {
        setOverview(result.data);
      }

      setOverviewLoading(false);
    }

    loadOverview();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadUsers() {
      setUsersLoading(true);
      setUsersError("");
      const result = await fetchAdminUsers(deferredSearch, page, PAGE_SIZE);
      if (!isActive) return;

      if (!result.ok || !result.data) {
        setUsers([]);
        setUsersTotal(0);
        setUsersError(result.error || "Impossibile caricare gli utenti.");
      } else {
        setUsers(result.data.users);
        setUsersTotal(result.data.total);
      }

      setUsersLoading(false);
    }

    loadUsers();
    return () => {
      isActive = false;
    };
  }, [deferredSearch, page]);

  useEffect(() => {
    if (!selectedUserId) return;

    let isActive = true;

    async function loadDetail() {
      setDetailLoading(true);
      setDetailError("");
      const result = await fetchAdminUserDetail(selectedUserId);
      if (!isActive) return;

      if (!result.ok || !result.data) {
        setSelectedUser(null);
        setDetailError(result.error || "Impossibile caricare il dettaglio utente.");
      } else {
        setSelectedUser(result.data);
      }

      setDetailLoading(false);
    }

    loadDetail();
    return () => {
      isActive = false;
    };
  }, [selectedUserId]);

  const totalPages = Math.max(1, Math.ceil(usersTotal / PAGE_SIZE));

  const refreshOverview = async () => {
    setOverviewLoading(true);
    const result = await fetchAdminOverview();
    if (!result.ok || !result.data) {
      setOverviewError(result.error || "Impossibile aggiornare la panoramica.");
    } else {
      setOverview(result.data);
      setOverviewError("");
    }
    setOverviewLoading(false);
  };

  const refreshUsers = async () => {
    setUsersLoading(true);
    const result = await fetchAdminUsers(deferredSearch, page, PAGE_SIZE);
    if (!result.ok || !result.data) {
      setUsers([]);
      setUsersTotal(0);
      setUsersError(result.error || "Impossibile aggiornare gli utenti.");
    } else {
      setUsers(result.data.users);
      setUsersTotal(result.data.total);
      setUsersError("");
    }
    setUsersLoading(false);
  };

  const refreshSelectedUser = async (userId: string) => {
    const result = await fetchAdminUserDetail(userId);
    if (result.ok && result.data) {
      setSelectedUser(result.data);
      setDetailError("");
    }
  };

  const handleDeleteSuggestion = async (suggestion: AdminSuggestionSummary) => {
    setBusySuggestionIds((prev) => [...prev, suggestion.id]);
    const result = await deleteAdminSuggestion(suggestion.id);
    setBusySuggestionIds((prev) => prev.filter((id) => id !== suggestion.id));

    if (!result.ok) {
      alert(result.error || "Impossibile eliminare il suggerimento.");
      return;
    }

    if (overview) {
      setOverview({
        ...overview,
        recentSuggestions: overview.recentSuggestions.filter((item) => item.id !== suggestion.id),
        suggestionsTotal: Math.max(0, overview.suggestionsTotal - 1),
      });
    }

    if (selectedUser) {
      setSelectedUser({
        ...selectedUser,
        recentSuggestions: selectedUser.recentSuggestions.filter((item) => item.id !== suggestion.id),
        suggestionsCount: Math.max(0, selectedUser.suggestionsCount - 1),
      });
    }

    await refreshOverview();
    await refreshUsers();

    if (selectedUserId) {
      await refreshSelectedUser(selectedUserId);
    }
  };

  const handleToggleAdmin = async (user: AdminUserRow | AdminUserDetail) => {
    const nextIsAdmin = !user.isAdmin;
    setBusyRoleIds((prev) => [...prev, user.id]);
    const result = await setAdminRole(user.id, nextIsAdmin);
    setBusyRoleIds((prev) => prev.filter((id) => id !== user.id));

    if (!result.ok) {
      alert(result.error || "Impossibile aggiornare il ruolo admin.");
      return;
    }

    setUsers((prev) => prev.map((row) => (row.id === user.id ? { ...row, isAdmin: nextIsAdmin } : row)));

    if (selectedUser?.id === user.id) {
      setSelectedUser({ ...selectedUser, isAdmin: nextIsAdmin });
    }

    if (user.id === currentUserId) {
      onAdminStateChange?.(nextIsAdmin);
    }
  };

  return (
    <div className="admin-page">
      <section className="admin-hero">
        <div className="admin-hero-copy">
          <span className="admin-eyebrow">System Control</span>
          <h1>Dashboard Admin</h1>
          <p>Vista completa su utenti, community e numeri reali della piattaforma.</p>
        </div>
        <div className="admin-hero-actions">
          <button className="pill ghost" onClick={refreshOverview}>Aggiorna KPI</button>
          <button className="pill solid" onClick={refreshUsers}>Aggiorna utenti</button>
        </div>
      </section>

      <SectionTitle
        eyebrow="Overview"
        title="Stato della piattaforma"
        subtitle="KPI operativi costruiti sui dati reali gia presenti in Supabase."
      />

      <CommunityPulse />

      {overviewLoading ? (
        <div className="admin-loading">Caricamento overview admin...</div>
      ) : overviewError ? (
        <div className="admin-error">{overviewError}</div>
      ) : overview && (
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
            <CommunityList title="Piu visti" items={overview.topWatched} variant="watched" />
            <CommunityList title="Piu amati" items={overview.topLoved} variant="loved" />
            <CommunityList title="Piu completati" items={overview.topCompleted} variant="completed" />
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
                      onClick={() => handleDeleteSuggestion(suggestion)}
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
      )}

      <SectionTitle
        eyebrow="Users"
        title="Utenti registrati"
        subtitle="Ricerca, ruolo admin e dettaglio operativo per ogni account."
      />

      <section className="admin-users-shell">
        <div className="admin-users-main admin-panel">
          <div className="admin-users-toolbar">
            <div>
              <h3>Utenti</h3>
              <p>{usersTotal} account trovati.</p>
            </div>
            <input
              className="admin-search"
              placeholder="Cerca email o username..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {usersLoading ? (
            <div className="admin-loading">Caricamento utenti...</div>
          ) : usersError ? (
            <div className="admin-error">{usersError}</div>
          ) : users.length === 0 ? (
            <div className="admin-empty-inline">Nessun utente trovato con questo filtro.</div>
          ) : (
            <>
              <div className="admin-users-table">
                <div className="admin-users-head">
                  <span>Utente</span>
                  <span>Attivita</span>
                  <span>Ruolo</span>
                  <span>Azioni</span>
                </div>
                {users.map((user) => (
                  <article key={user.id} className="admin-users-row">
                    <button className="admin-user-identity" onClick={() => setSelectedUserId(user.id)}>
                      <img src={user.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Admin"} alt={user.username} />
                      <div className="admin-user-identity-text">
                        <strong>{user.username}</strong>
                        <span>{user.email}</span>
                        <small>Creato il {formatDate(user.createdAt)}</small>
                      </div>
                    </button>
                    <div className="admin-user-stats">
                      <span>{user.libraryCount} titoli</span>
                      <span>{user.ratingsCount} voti</span>
                      <span>{user.suggestionsCount} suggerimenti</span>
                    </div>
                    <div className="admin-role-cell">
                      <span className={`admin-role-badge ${user.isAdmin ? "is-admin" : ""}`}>
                        {user.isAdmin ? "Admin" : "Utente"}
                      </span>
                      <small>Ultimo accesso: {formatDateTime(user.lastSignInAt)}</small>
                    </div>
                    <div className="admin-user-actions">
                      <button className="pill ghost" onClick={() => setSelectedUserId(user.id)}>Dettaglio</button>
                      <button
                        className={`pill ${user.isAdmin ? "ghost" : "solid"}`}
                        onClick={() => handleToggleAdmin(user)}
                        disabled={busyRoleIds.includes(user.id)}
                      >
                        {busyRoleIds.includes(user.id)
                          ? "Aggiorno..."
                          : user.isAdmin
                            ? "Rimuovi admin"
                            : "Promuovi admin"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="admin-pagination">
                <button className="pill ghost" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1}>
                  Indietro
                </button>
                <span>Pagina {page} di {totalPages}</span>
                <button
                  className="pill ghost"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                >
                  Avanti
                </button>
              </div>
            </>
          )}
        </div>

        <aside className={`admin-detail-drawer ${selectedUserId ? "is-open" : ""}`}>
          <div className="admin-detail-header">
            <div>
              <span>Dettaglio utente</span>
              <h3>{selectedUser?.username || "Seleziona un utente"}</h3>
            </div>
            {selectedUserId && (
              <button
                className="pill ghost"
                onClick={() => {
                  setSelectedUserId(null);
                  setSelectedUser(null);
                }}
              >
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
                  onClick={() => handleToggleAdmin(selectedUser)}
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
                    <span>Gia guardato</span>
                    <strong>{selectedUser.statusBreakdown["gia-guardato"] || 0}</strong>
                  </article>
                  <article>
                    <span>Pianificato</span>
                    <strong>{selectedUser.statusBreakdown["pianificato"] || 0}</strong>
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
                          onClick={() => handleDeleteSuggestion(suggestion)}
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
      </section>
    </div>
  );
}
