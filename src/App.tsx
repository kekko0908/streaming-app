import { useNavigate, useLocation } from "react-router-dom";
import "./css/global.css";
import "./css/archive.css";
import { TmdbItem, WatchStatus } from "./types/types";
import { useAppShellState } from "./hooks/useAppShellState";
import { useHomeScreenState } from "./hooks/useHomeScreenState";
import { useMyListViewState } from "./hooks/useMyListViewState";
import { usePlayerController } from "./hooks/usePlayerController";
import { useSelectedMedia } from "./hooks/useSelectedMedia";
import { useStore } from "./hooks/useStore";
import Navbar from "./components/Navbar";
import SiteLock from "./components/SiteLock";
import { AppOverlays } from "./components/app/AppOverlays";
import { AppRoutes } from "./components/app/AppRoutes";
import { UPDATES_VERSION, updatesItems } from "./components/app/appUpdates";

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    myList,
    addToList,
    removeFromList,
    updateProgress,
    updateMediaType,
    getProgress,
    rateItem,
    loading: listLoading,
    isUILocked,
    toggleUILock,
  } = useStore();
  (window as any).sfaStore = { isUILocked, toggleUILock };
  const {
    session,
    isAdmin,
    setIsAdmin,
    adminReady,
    showUpdates,
    setShowUpdates,
    handleLogout,
    handleCloseUpdates,
  } = useAppShellState(navigate);
  const {
    selected,
    setSelected,
    selectItem,
    resetSelection,
  } = useSelectedMedia({
    navigate,
  });
  const {
    query,
    setQuery,
    results,
    homeLists,
    homeSpotlightReady,
    spotlightItem,
    runSearch,
    clearSearch,
    dismissSearchResults,
    setConfiguredSpotlight,
  } = useHomeScreenState({
    session,
    onSearchResultsShown: () => {
      navigate("/");
      setSelected(null);
    },
  });
  const {
    listSearch,
    setListSearch,
    listTypeFilter,
    setListTypeFilter,
    listStatusFilter,
    setListStatusFilter,
    listSort,
    setListSort,
    filteredMyList,
  } = useMyListViewState(myList);
  const {
    handlePlay,
    clearAllPlayerState,
    playerOverlayProps,
  } = usePlayerController({
    session,
    navigate,
    myList,
    addToList,
    removeFromList,
    updateProgress,
    getProgress,
    selected,
    setSelected,
  });

  const handleAddToList = (item: TmdbItem, status: unknown) => {
    if (!session) {
      alert("Devi accedere!");
      navigate("/auth");
      return;
    }
    addToList(item, status as WatchStatus);
  };

  const handleRate = (item: TmdbItem, rating: number) => {
    if (!session) {
      alert("Devi accedere!");
      return;
    }
    rateItem(item, rating);
  };

  const handleAppLogout = async () => {
    clearAllPlayerState();
    setSelected(null);
    await handleLogout();
  };

  const isAuthRoute = location.pathname === "/auth";
  if (!session && !isAuthRoute) return <SiteLock onLogin={() => navigate("/auth")} />;

  return (
    <div className="app">
      {session && (
        <Navbar
          resetSelection={() => {
            clearAllPlayerState();
            resetSelection();
          }}
          query={query}
          setQuery={setQuery}
          onSearch={runSearch}
          session={session}
          onLogout={handleAppLogout}
          onShowUpdates={() => setShowUpdates(true)}
          isAdmin={isAdmin}
        />
      )}

      <AppRoutes
        location={location}
        session={session}
        isAdmin={isAdmin}
        adminReady={adminReady}
        selected={selected}
        myList={myList}
        results={results}
        query={query}
        homeLists={homeLists}
        spotlightItem={spotlightItem}
        homeSpotlightReady={homeSpotlightReady}
        isUILocked={isUILocked}
        filteredMyList={filteredMyList}
        listLoading={listLoading}
        listSearch={listSearch}
        listTypeFilter={listTypeFilter}
        listStatusFilter={listStatusFilter}
        listSort={listSort}
        getProgress={getProgress}
        onSetAdmin={setIsAdmin}
        onSetHomeSpotlight={setConfiguredSpotlight}
        onPlay={handlePlay}
        onAddToList={handleAddToList}
        onRate={handleRate}
        onRemoveSelectedFromList={() => selected && removeFromList(selected.tmdbId)}
        onSelectItem={(item) => {
          clearAllPlayerState();
          dismissSearchResults();
          selectItem(item);
        }}
        onCloseSelected={() => {
          clearAllPlayerState();
          resetSelection();
          navigate("/");
        }}
        onToggleUILock={toggleUILock}
        onClearSearch={clearSearch}
        onSelectedChange={setSelected}
        onListSearchChange={setListSearch}
        onListTypeFilterChange={setListTypeFilter}
        onListStatusFilterChange={setListStatusFilter}
        onListSortChange={setListSort}
        onRemoveFromList={removeFromList}
        onTypeChange={updateMediaType}
      />

      <AppOverlays
        session={session}
        {...playerOverlayProps}
        showUpdates={showUpdates}
        updatesItems={updatesItems}
        updatesVersion={UPDATES_VERSION}
        onCloseUpdates={handleCloseUpdates}
      />
    </div>
  );
}
