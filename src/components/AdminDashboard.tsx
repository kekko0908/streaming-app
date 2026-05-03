import { useDeferredValue, useEffect, useState } from "react";
import {
  AdminOverview,
  AdminSuggestionSummary,
  AdminUserDetail,
  AdminUserRow,
  MediaType,
  TmdbItem,
} from "../types/types";
import { fetchDetails, searchTmdb } from "../utils/api";
import {
  deleteAdminSuggestion,
  fetchAdminOverview,
  fetchAdminUserDetail,
  fetchAdminUsers,
  setAdminRole,
} from "../utils/adminApi";
import {
  clearHomeSpotlightSetting,
  getHomeSpotlightSetting,
  setHomeSpotlightSetting,
} from "../utils/siteSettings";
import { AdminHero, SectionTitle } from "./admin/AdminShared";
import { AdminOverviewSection } from "./admin/AdminOverviewSection";
import { AdminUserDetailDrawer } from "./admin/AdminUserDetailDrawer";
import { AdminUsersPanel } from "./admin/AdminUsersPanel";
import { HomeSpotlightAdminPanel } from "./admin/HomeSpotlightAdminPanel";
import "../css/admin.css";

interface AdminDashboardProps {
  currentUserId: string;
  onAdminStateChange?: (isAdmin: boolean) => void;
  onHomeSpotlightChange?: (item: TmdbItem | null) => void;
}

const PAGE_SIZE = 12;

export default function AdminDashboard({ currentUserId, onAdminStateChange, onHomeSpotlightChange }: AdminDashboardProps) {
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
  const [spotlightItem, setSpotlightItem] = useState<TmdbItem | null>(null);
  const [spotlightType, setSpotlightType] = useState<MediaType>("movie");
  const [spotlightQuery, setSpotlightQuery] = useState("");
  const [spotlightResults, setSpotlightResults] = useState<TmdbItem[]>([]);
  const [spotlightLoading, setSpotlightLoading] = useState(false);
  const [spotlightSaving, setSpotlightSaving] = useState(false);
  const [spotlightMessage, setSpotlightMessage] = useState("");

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
    const userId = selectedUserId;

    async function loadDetail() {
      setDetailLoading(true);
      setDetailError("");
      const result = await fetchAdminUserDetail(userId);
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

  useEffect(() => {
    let isActive = true;

    async function loadSpotlight() {
      setSpotlightLoading(true);
      setSpotlightMessage("");

      try {
        const setting = await getHomeSpotlightSetting();
        if (!setting) {
          if (isActive) setSpotlightItem(null);
          return;
        }

        const item = await fetchDetails(setting.tmdbId, setting.type);
        if (isActive) setSpotlightItem(item);
      } catch (error) {
        if (isActive) {
          setSpotlightItem(null);
          setSpotlightMessage("Impossibile caricare il titolo selezionato.");
        }
      } finally {
        if (isActive) setSpotlightLoading(false);
      }
    }

    loadSpotlight();

    return () => {
      isActive = false;
    };
  }, []);

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

  const handleSpotlightSearch = async () => {
    const query = spotlightQuery.trim();
    if (query.length < 2) {
      setSpotlightResults([]);
      setSpotlightMessage("Inserisci almeno 2 caratteri per cercare un titolo.");
      return;
    }

    setSpotlightLoading(true);
    setSpotlightMessage("");

    try {
      const results = await searchTmdb(query, spotlightType);
      setSpotlightResults(results.slice(0, 8));
      if (results.length === 0) setSpotlightMessage("Nessun titolo trovato.");
    } catch (error) {
      console.error("Errore ricerca spotlight:", error);
      setSpotlightResults([]);
      setSpotlightMessage("Ricerca non riuscita.");
    } finally {
      setSpotlightLoading(false);
    }
  };

  const handleSelectSpotlight = async (item: TmdbItem) => {
    setSpotlightSaving(true);
    setSpotlightMessage("");

    try {
      const fullItem = await fetchDetails(item.tmdbId, item.type);
      await setHomeSpotlightSetting({ tmdbId: fullItem.tmdbId, type: fullItem.type });
      setSpotlightItem(fullItem);
      setSpotlightResults([]);
      setSpotlightQuery("");
      setSpotlightMessage(`Titolo selezionato aggiornato: ${fullItem.title}`);
      onHomeSpotlightChange?.(fullItem);
    } catch (error) {
      console.error("Errore salvataggio spotlight:", error);
      setSpotlightMessage("Impossibile salvare il titolo selezionato.");
    } finally {
      setSpotlightSaving(false);
    }
  };

  const handleClearSpotlight = async () => {
    setSpotlightSaving(true);
    setSpotlightMessage("");

    try {
      await clearHomeSpotlightSetting();
      setSpotlightItem(null);
      setSpotlightResults([]);
      setSpotlightQuery("");
      setSpotlightMessage("Titolo selezionato rimosso. La home usera il fallback automatico.");
      onHomeSpotlightChange?.(null);
    } catch (error) {
      console.error("Errore reset spotlight:", error);
      setSpotlightMessage("Impossibile rimuovere il titolo selezionato.");
    } finally {
      setSpotlightSaving(false);
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

  const closeUserDetail = () => {
    setSelectedUserId(null);
    setSelectedUser(null);
  };

  return (
    <div className="admin-page">
      <AdminHero onRefreshOverview={refreshOverview} onRefreshUsers={refreshUsers} />

      <SectionTitle
        eyebrow="Overview"
        title="Stato della piattaforma"
        subtitle="KPI operativi costruiti sui dati reali gia presenti in Supabase."
      />

      <HomeSpotlightAdminPanel
        spotlightItem={spotlightItem}
        spotlightType={spotlightType}
        spotlightQuery={spotlightQuery}
        spotlightResults={spotlightResults}
        spotlightLoading={spotlightLoading}
        spotlightSaving={spotlightSaving}
        spotlightMessage={spotlightMessage}
        onClearSpotlight={handleClearSpotlight}
        onSearch={handleSpotlightSearch}
        onSelectSpotlight={handleSelectSpotlight}
        onSpotlightTypeChange={setSpotlightType}
        onSpotlightQueryChange={setSpotlightQuery}
      />

      <AdminOverviewSection
        overview={overview}
        loading={overviewLoading}
        error={overviewError}
        busySuggestionIds={busySuggestionIds}
        onDeleteSuggestion={handleDeleteSuggestion}
      />

      <SectionTitle
        eyebrow="Users"
        title="Utenti registrati"
        subtitle="Ricerca, ruolo admin e dettaglio operativo per ogni account."
      />

      <section className="admin-users-shell">
        <AdminUsersPanel
          users={users}
          usersTotal={usersTotal}
          usersLoading={usersLoading}
          usersError={usersError}
          search={search}
          page={page}
          totalPages={totalPages}
          busyRoleIds={busyRoleIds}
          onSearchChange={setSearch}
          onPageChange={setPage}
          onSelectUser={setSelectedUserId}
          onToggleAdmin={handleToggleAdmin}
        />

        <AdminUserDetailDrawer
          selectedUserId={selectedUserId}
          selectedUser={selectedUser}
          detailLoading={detailLoading}
          detailError={detailError}
          busyRoleIds={busyRoleIds}
          busySuggestionIds={busySuggestionIds}
          onClose={closeUserDetail}
          onToggleAdmin={handleToggleAdmin}
          onDeleteSuggestion={handleDeleteSuggestion}
        />
      </section>
    </div>
  );
}
