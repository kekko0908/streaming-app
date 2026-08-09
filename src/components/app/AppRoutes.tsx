import { lazy } from "react";
import { Routes, Route, Navigate, Location } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Session } from "@supabase/supabase-js";
import { SavedItem, TmdbItem, WatchStatus } from "../../types/types";
import type { GenrePreference } from "../../utils/recommendations";
import { DeferredSection, PageTransition, RequireAdmin, RequireAuth } from "./AppShell";
import { DetailRouteContent } from "./DetailRouteContent";
import { HomeRouteContent } from "./HomeRouteContent";
import { MyListRouteContent } from "./MyListRouteContent";

const AuthForm = lazy(() => import("../AuthForm"));
const Profile = lazy(() => import("../Profile"));
const Archive = lazy(() => import("../Archive"));
const Ranking = lazy(() => import("../Ranking"));
const Suggestions = lazy(() => import("../Suggestions"));
const ReleaseCalendar = lazy(() => import("../ReleaseCalendar"));
const AdminDashboard = lazy(() => import("../AdminDashboard"));
const NotFoundPage = lazy(() => import("../NotFoundPage"));
const PersonalizedRecommendations = lazy(() => import("../PersonalizedRecommendations"));

export type HomeLists = {
  trending: TmdbItem[];
  upcoming: TmdbItem[];
  popular: TmdbItem[];
  drama: TmdbItem[];
  action: TmdbItem[];
  adventure: TmdbItem[];
  animation: TmdbItem[];
  horror: TmdbItem[];
  comedy: TmdbItem[];
  thriller: TmdbItem[];
  scienceFiction: TmdbItem[];
  fantasy: TmdbItem[];
  crime: TmdbItem[];
  documentary: TmdbItem[];
  family: TmdbItem[];
  romance: TmdbItem[];
  mystery: TmdbItem[];
  newReleases: TmdbItem[];
  recommendations: TmdbItem[];
  genreProfile: GenrePreference[];
};

export function AppRoutes({
  location,
  session,
  isAdmin,
  adminReady,
  selected,
  myList,
  results,
  query,
  homeLists,
  spotlightItem,
  homeSpotlightReady,
  isUILocked,
  filteredMyList,
  listLoading,
  listSearch,
  listTypeFilter,
  listStatusFilter,
  listSort,
  getProgress,
  onSetAdmin,
  onSetHomeSpotlight,
  onPlay,
  onAddToList,
  onRate,
  onRemoveSelectedFromList,
  onSelectItem,
  onCloseSelected,
  onToggleUILock,
  onClearSearch,
  onSelectedChange,
  onListSearchChange,
  onListTypeFilterChange,
  onListStatusFilterChange,
  onListSortChange,
  onRemoveFromList,
  onTypeChange,
}: {
  location: Location;
  session: Session | null;
  isAdmin: boolean;
  adminReady: boolean;
  selected: TmdbItem | null;
  myList: SavedItem[];
  results: TmdbItem[];
  query: string;
  homeLists: HomeLists;
  spotlightItem?: TmdbItem;
  homeSpotlightReady: boolean;
  isUILocked: boolean;
  filteredMyList: SavedItem[];
  listLoading: boolean;
  listSearch: string;
  listTypeFilter: "all" | "movie" | "tv";
  listStatusFilter: "all" | WatchStatus;
  listSort: "added" | "rating" | "year";
  getProgress: (tmdbId: string) => { season: number; episode: number; watchedEpisodes?: number; totalEpisodes?: number; progressSeconds?: number; progressMinutes?: number };
  onSetAdmin: (isAdmin: boolean) => void;
  onSetHomeSpotlight: (item: TmdbItem | null) => void;
  onPlay: (season: number, episode: number, item: TmdbItem) => void;
  onAddToList: (item: TmdbItem, status: unknown) => void;
  onRate: (item: TmdbItem, rating: number) => void;
  onRemoveSelectedFromList: () => void;
  onSelectItem: (item: TmdbItem) => void;
  onCloseSelected: () => void;
  onToggleUILock: () => void;
  onClearSearch: () => void;
  onSelectedChange: (item: TmdbItem | null) => void;
  onListSearchChange: (value: string) => void;
  onListTypeFilterChange: (value: "all" | "movie" | "tv") => void;
  onListStatusFilterChange: (value: "all" | WatchStatus) => void;
  onListSortChange: (value: "added" | "rating" | "year") => void;
  onRemoveFromList: (tmdbId: string) => void;
  onTypeChange: (tmdbId: string, nextType: "movie" | "tv") => void;
}) {
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/auth" element={!session ? <DeferredSection><PageTransition><AuthForm /></PageTransition></DeferredSection> : <Navigate to="/" />} />
        <Route path="/profile" element={<RequireAuth session={session}><DeferredSection><PageTransition><Profile /></PageTransition></DeferredSection></RequireAuth>} />
        <Route
          path="/admin"
          element={
            <RequireAdmin session={session} isAdmin={isAdmin} adminReady={adminReady}>
              <DeferredSection>
                <PageTransition>
                  <AdminDashboard
                    currentUserId={session?.user?.id || ""}
                    onAdminStateChange={onSetAdmin}
                    onHomeSpotlightChange={onSetHomeSpotlight}
                  />
                </PageTransition>
              </DeferredSection>
            </RequireAdmin>
          }
        />
        <Route
          path="/"
          element={
            <RequireAuth session={session}>
              <PageTransition>
                <HomeRouteContent
                  session={session}
                  myList={myList}
                  results={results}
                  query={query}
                  homeLists={homeLists}
                  spotlightItem={spotlightItem}
                  homeSpotlightReady={homeSpotlightReady}
                  getProgress={getProgress}
                  onPlay={onPlay}
                  onSelectItem={onSelectItem}
                  onClearSearch={onClearSearch}
                />
              </PageTransition>
            </RequireAuth>
          }
        />
        <Route
          path="/film/:slug"
          element={
            <RequireAuth session={session}>
              <PageTransition>
                <DetailRouteContent
                  selected={selected}
                  myList={myList}
                  isUILocked={isUILocked}
                  getProgress={getProgress}
                  onPlay={onPlay}
                  onAddToList={onAddToList}
                  onRate={onRate}
                  onRemoveSelectedFromList={onRemoveSelectedFromList}
                  onSelectItem={onSelectItem}
                  onCloseSelected={onCloseSelected}
                  onSelectCollectionItem={onSelectItem}
                  onToggleUILock={onToggleUILock}
                  onSelectedChange={onSelectedChange}
                />
              </PageTransition>
            </RequireAuth>
          }
        />
        <Route
          path="/serie-tv/:slug"
          element={
            <RequireAuth session={session}>
              <PageTransition>
                <DetailRouteContent
                  selected={selected}
                  myList={myList}
                  isUILocked={isUILocked}
                  getProgress={getProgress}
                  onPlay={onPlay}
                  onAddToList={onAddToList}
                  onRate={onRate}
                  onRemoveSelectedFromList={onRemoveSelectedFromList}
                  onSelectItem={onSelectItem}
                  onCloseSelected={onCloseSelected}
                  onSelectCollectionItem={onSelectItem}
                  onToggleUILock={onToggleUILock}
                  onSelectedChange={onSelectedChange}
                />
              </PageTransition>
            </RequireAuth>
          }
        />
        <Route path="/archive" element={<Navigate to="/archivio" replace />} />
        <Route path="/archivio" element={<RequireAuth session={session}><DeferredSection><PageTransition><Archive onSelect={onSelectItem} /></PageTransition></DeferredSection></RequireAuth>} />
        <Route
          path="/list"
          element={
            <RequireAuth session={session}>
              <PageTransition>
                <MyListRouteContent
                  filteredMyList={filteredMyList}
                  listLoading={listLoading}
                  listSearch={listSearch}
                  listTypeFilter={listTypeFilter}
                  listStatusFilter={listStatusFilter}
                  listSort={listSort}
                  isAdmin={isAdmin}
                  getProgress={getProgress}
                  onListSearchChange={onListSearchChange}
                  onListTypeFilterChange={onListTypeFilterChange}
                  onListStatusFilterChange={onListStatusFilterChange}
                  onListSortChange={onListSortChange}
                  onSelectItem={onSelectItem}
                  onRemoveFromList={onRemoveFromList}
                  onTypeChange={onTypeChange}
                />
              </PageTransition>
            </RequireAuth>
          }
        />
        <Route path="/ranking" element={<Navigate to="/classifica" replace />} />
        <Route path="/classifica" element={<RequireAuth session={session}><DeferredSection><PageTransition><Ranking /></PageTransition></DeferredSection></RequireAuth>} />
        <Route path="/calendario" element={<RequireAuth session={session}><DeferredSection><PageTransition><ReleaseCalendar upcoming={homeLists.upcoming} myList={myList} onSelect={onSelectItem} /></PageTransition></DeferredSection></RequireAuth>} />
        <Route path="/per-te" element={<RequireAuth session={session}><DeferredSection><PageTransition><PersonalizedRecommendations items={homeLists.recommendations} profile={homeLists.genreProfile} historyCount={myList.filter((item) => item.status !== "da-guardare").length} onSelect={onSelectItem} /></PageTransition></DeferredSection></RequireAuth>} />
        <Route path="/suggestions" element={<RequireAuth session={session}><DeferredSection><PageTransition><Suggestions onSelect={onSelectItem} session={session} /></PageTransition></DeferredSection></RequireAuth>} />
        <Route path="/404" element={<DeferredSection><PageTransition><NotFoundPage /></PageTransition></DeferredSection>} />
        <Route path="*" element={<DeferredSection><PageTransition><NotFoundPage /></PageTransition></DeferredSection>} />
      </Routes>
    </AnimatePresence>
  );
}
