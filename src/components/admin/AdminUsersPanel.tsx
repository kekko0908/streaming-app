import { AdminUserRow } from "../../types/types";
import { formatDate, formatDateTime } from "./adminFormat";

export function AdminUsersPanel({
  users,
  usersTotal,
  usersLoading,
  usersError,
  search,
  page,
  totalPages,
  busyRoleIds,
  onSearchChange,
  onPageChange,
  onSelectUser,
  onToggleAdmin,
}: {
  users: AdminUserRow[];
  usersTotal: number;
  usersLoading: boolean;
  usersError: string;
  search: string;
  page: number;
  totalPages: number;
  busyRoleIds: string[];
  onSearchChange: (value: string) => void;
  onPageChange: (page: number | ((prev: number) => number)) => void;
  onSelectUser: (userId: string) => void;
  onToggleAdmin: (user: AdminUserRow) => void;
}) {
  return (
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
          onChange={(event) => onSearchChange(event.target.value)}
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
                <button className="admin-user-identity" onClick={() => onSelectUser(user.id)}>
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
                  <button className="pill ghost" onClick={() => onSelectUser(user.id)}>Dettaglio</button>
                  <button
                    className={`pill ${user.isAdmin ? "ghost" : "solid"}`}
                    onClick={() => onToggleAdmin(user)}
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
            <button className="pill ghost" onClick={() => onPageChange((prev) => Math.max(1, prev - 1))} disabled={page === 1}>
              Indietro
            </button>
            <span>Pagina {page} di {totalPages}</span>
            <button
              className="pill ghost"
              onClick={() => onPageChange((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
            >
              Avanti
            </button>
          </div>
        </>
      )}
    </div>
  );
}
