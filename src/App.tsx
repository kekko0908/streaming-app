import { Suspense, lazy, useEffect, useState } from "react";
import { Routes, Route, useNavigate, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import "./css/global.css";
import "./css/archive.css"; 
import { TmdbItem, STATUS_SECTIONS, WatchStatus } from "./types/types";
import { 
  fetchCollection, 
  searchTmdb, 
  fetchDetails, 
  fetchByGenre, 
  fetchPopularMovies,
  fetchUpcoming,
  fetchNowPlaying,
  fetchRecommendations,
  fetchPersonCredits,
  fetchCredits, 
  CastMember    
} from "./utils/api";
import { formatDate } from "./utils/helper";
import { useStore } from "./hooks/useStore";
import { supabase } from "./supabaseClient";
import { Session } from "@supabase/supabase-js";

// Components
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import HomeSpotlight from "./components/HomeSpotlight";
import Card, { SkeletonCard } from "./components/Card";
import CarouselSection from "./components/CarouselSection"; 
import CastList from "./components/CastList"; 
import CommunityPulse from "./components/CommunityPulse"; 
import CommunityShelf from "./components/CommunityShelf";
import SiteLock from "./components/SiteLock"; 
import type { UpdateItem } from "./components/UpdatesModal";
import { setTrailerPlaybackBlocked } from "./utils/trailerPlayback";

const AuthForm = lazy(() => import("./components/AuthForm"));
const Profile = lazy(() => import("./components/Profile"));
const Archive = lazy(() => import("./components/Archive"));
const Ranking = lazy(() => import("./components/Ranking"));
const Suggestions = lazy(() => import("./components/Suggestions"));
const AdminDashboard = lazy(() => import("./components/AdminDashboard"));
const PlayerDrawer = lazy(() => import("./components/PlayerDrawer"));
const UpdatesModal = lazy(() => import("./components/UpdatesModal"));

function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function DeferredSection({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageTransition><div style={{ padding: "50px", textAlign: "center", color: "#888" }}>Caricamento...</div></PageTransition>}>
      {children}
    </Suspense>
  );
}

function DeferredOverlay({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="drawer-backdrop"><div className="drawer drawer-responsive" style={{ minHeight: "240px", display: "grid", placeItems: "center", color: "#888" }}>Caricamento player...</div></div>}>
      {children}
    </Suspense>
  );
}

function RequireAuth({ session, children }: { session: Session | null; children: React.ReactNode }) {
  return session ? <>{children}</> : <Navigate to="/auth" replace />;
}

function RequireAdmin({
  session,
  isAdmin,
  adminReady,
  children,
}: {
  session: Session | null;
  isAdmin: boolean;
  adminReady: boolean;
  children: React.ReactNode;
}) {
  if (!session) return <Navigate to="/auth" replace />;
  if (!adminReady) {
    return (
      <PageTransition>
        <div style={{ padding: "50px", textAlign: "center", color: "#888" }}>Controllo permessi admin...</div>
      </PageTransition>
    );
  }
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const UPDATES_STORAGE_KEY = "sfa_updates_seen";
  const UPDATES_VERSION = "1.5.0";
  const updatesItems: UpdateItem[] = [
    {
      title: "Dashboard Admin",
      text: "Gli amministratori possono controllare utenti, KPI, suggerimenti recenti e ruoli da una nuova area dedicata."
    },
    {
      title: "Statistiche piu affidabili",
      text: "Il tracciamento evita doppi conteggi dello stesso episodio e mantiene piu puliti eventi e progressi."
    },
    {
      title: "Catalogo piu preciso",
      text: "La sincronizzazione dei titoli salva meglio tipo, durata, poster, generi ed episodi totali per ranking e profili."
    }
  ];
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminReady, setAdminReady] = useState(false);

  const { myList, addToList, removeFromList, updateProgress, updateMediaType, getProgress, rateItem, loading: listLoading, isUILocked, toggleUILock } = useStore();
  (window as any).sfaStore = { isUILocked, toggleUILock };

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbItem[]>([]);
  const [listSearch, setListSearch] = useState("");
  const [listTypeFilter, setListTypeFilter] = useState<"all" | "movie" | "tv">("all");
  const [listStatusFilter, setListStatusFilter] = useState<"all" | WatchStatus>("all");
  const [listSort, setListSort] = useState<"added" | "rating" | "year">("added");

  const [homeLists, setHomeLists] = useState<{ 
    trending: TmdbItem[], upcoming: TmdbItem[], popular: TmdbItem[],
    drama: TmdbItem[], action: TmdbItem[], animation: TmdbItem[], horror: TmdbItem[],
    newReleases: TmdbItem[]
  }>({ 
    trending: [], upcoming: [], popular: [], drama: [], action: [], animation: [], horror: [], newReleases: []
  });

  const [selected, setSelected] = useState<TmdbItem | null>(null);
  const [related, setRelated] = useState<TmdbItem[]>([]);
  const [cast, setCast] = useState<CastMember[]>([]); 
  const [selectedActor, setSelectedActor] = useState<CastMember | null>(null);
  const [actorCredits, setActorCredits] = useState<TmdbItem[]>([]);
  const [showPlayer, setShowPlayer] = useState(false);
  const [isPipMode, setIsPipMode] = useState(false);
  const [playerState, setPlayerState] = useState<{season: number, episode: number, startAt?: number} | null>(null);
  const [unavailableItem, setUnavailableItem] = useState<TmdbItem | null>(null);
  const [showUpdates, setShowUpdates] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setIsAdmin(false);
        setAdminReady(false);
      }
      if (window.location.pathname === '/auth' && session) navigate('/');
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    let isActive = true;

    const loadAdminState = async () => {
      if (!session?.user?.id) {
        setIsAdmin(false);
        setAdminReady(true);
        return;
      }

      setAdminReady(false);
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!isActive) return;

      if (error) {
        console.error("Errore lettura ruolo admin:", error);
        setIsAdmin(false);
        setAdminReady(true);
        return;
      }

      setIsAdmin(Boolean(data?.is_admin));
      setAdminReady(true);
    };

    loadAdminState();

    return () => {
      isActive = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    let isActive = true;
    const loadUpdatesSeen = async () => {
      if (!session?.user) {
        setShowUpdates(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("updates_seen_version")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!isActive) return;
      if (error) {
        console.error("Errore lettura novita profilo:", error);
        setShowUpdates(true);
        return;
      }
      const seenVersion = data?.updates_seen_version;
      if (seenVersion !== UPDATES_VERSION) setShowUpdates(true);
    };
    loadUpdatesSeen();
    return () => {
      isActive = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    const syncTrailerPlaybackState = () => {
      setTrailerPlaybackBlocked(showPlayer || document.hidden);
    };

    syncTrailerPlaybackState();
    document.addEventListener("visibilitychange", syncTrailerPlaybackState);

    return () => {
      document.removeEventListener("visibilitychange", syncTrailerPlaybackState);
    };
  }, [showPlayer]);

  useEffect(() => {
    if (!session) return;

    let isActive = true;

    async function loadData() {
      try {
        const [trending, rawUpcoming, popular, newReleases, drama, action, animation, horror] = await Promise.all([
          fetchCollection("trending/all/day"),
          fetchUpcoming("IT"),
          fetchPopularMovies("IT"),
          fetchNowPlaying("IT"),
          fetchByGenre(18, "movie"),
          fetchByGenre(28, "movie"),
          fetchByGenre(16, "movie"),
          fetchByGenre(27, "movie")
        ]);
        
        const today = new Date().toISOString().split('T')[0];
        const realUpcoming = rawUpcoming.filter(item => item.releaseDateFull && item.releaseDateFull > today);

        if (!isActive) return;
        
        setHomeLists({ 
            trending: trending || [], 
            upcoming: realUpcoming || [], 
            popular: popular || [], 
            drama: drama || [],
            action: action || [], 
            animation: animation || [], 
            horror: horror || [],
            newReleases: newReleases || [] 
        });
      } catch (error) { console.error(error); }
    }

    loadData();

    return () => {
      isActive = false;
    };
  }, [session]);

  useEffect(() => {
    // Listener globale per Play Diretto dalle Card
    const handlePlayDirect = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const { item, season, episode } = customEvent.detail;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/auth");
          return;
        }
        const fullItem = await fetchDetails(item.tmdbId, item.type);
        if (typeof item.progressMinutes === "number") fullItem.progressMinutes = item.progressMinutes;
        setSelected(fullItem);
        const startAt = (fullItem.progressSeconds && fullItem.progressSeconds > 15) ? fullItem.progressSeconds : 0;
        setTrailerPlaybackBlocked(true);
        setPlayerState({ season, episode, startAt });
        setShowPlayer(true);
        
        // Se non abbiamo session, si può comunque vedere
        updateProgress(fullItem, season, episode);

      } catch (error) { console.error("Errore Play Diretto", error); }
    };
    window.addEventListener("play_direct", handlePlayDirect);

    return () => {
      window.removeEventListener("play_direct", handlePlayDirect);
    };
  }, [navigate, updateProgress]);

  const clearSupabaseAuthStorage = () => {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key === "supabase.auth.token") localStorage.removeItem(key);
        if (key.startsWith("sb-") && key.endsWith("-auth-token")) localStorage.removeItem(key);
      });
    } catch (error) {
      console.error("Errore pulizia storage auth:", error);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) console.error("Errore logout:", error);
    clearSupabaseAuthStorage();
    setSession(null);
    setIsAdmin(false);
    setAdminReady(false);
    setShowPlayer(false);
    setShowUpdates(false);
    navigate("/auth");
  };

  const runSearch = async () => {
    if (!query || query.trim() === "") {
      setResults([]);
      return;
    }
    try {
      const [movies, tv] = await Promise.all([searchTmdb(query, "movie"), searchTmdb(query, "tv")]);
      const flat = [...movies, ...tv].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      setResults(flat); navigate("/"); setSelected(null); setRelated([]);
    } catch (e) { console.error(e); }
  };

  const selectItem = async (item: TmdbItem) => {
    navigate("/"); setShowPlayer(false); window.scrollTo({ top: 0, behavior: "smooth" });
    const fullItem = await fetchDetails(item.tmdbId, item.type);
    if (typeof item.progressMinutes === "number") {
      fullItem.progressMinutes = item.progressMinutes;
    }
    setSelected(fullItem);
    setSelectedActor(null);
    setActorCredits([]);
    const [recsResult, actorsResult] = await Promise.allSettled([
      fetchRecommendations(item.tmdbId, item.type),
      fetchCredits(item.tmdbId, item.type)
    ]);
    setRelated(recsResult.status === "fulfilled" ? recsResult.value : []);
    setCast(actorsResult.status === "fulfilled" ? actorsResult.value : []);
  };

  const handleAddToList = (status: any) => {
    if (!session) { alert("Devi accedere!"); navigate("/auth"); return; }
    if (selected) addToList(selected, status);
  };
  const handleRate = (rating: number) => {
    if (!session) { alert("Devi accedere!"); return; }
    if (selected) rateItem(selected, rating);
  };
  const handleActorSelect = async (actor: CastMember) => {
    setSelectedActor(actor);
    try {
      const credits = await fetchPersonCredits(actor.id);
      setActorCredits(credits.filter(c => c.type === "movie"));
    } catch (e) {
      console.error(e);
      setActorCredits([]);
    }
  };
  const isUpcomingMovie = (item: TmdbItem) => {
    if (item.type !== "movie" || !item.releaseDateFull) return false;
    const releaseDate = new Date(item.releaseDateFull);
    if (Number.isNaN(releaseDate.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    releaseDate.setHours(0, 0, 0, 0);
    return releaseDate > today;
  };
  const handlePlay = (season: number, episode: number, item?: TmdbItem) => {
    if (!session) {
      alert("Devi accedere!");
      navigate("/auth");
      return;
    }
    const target = item || selected;
    if (!target) return;
    if (isUpcomingMovie(target)) {
      setUnavailableItem(target);
      return;
    }
    const startAt = (target.progressSeconds && target.progressSeconds > 15) ? target.progressSeconds : 0;
    setTrailerPlaybackBlocked(true);
    setPlayerState({ season, episode, startAt });
    setShowPlayer(true);
    updateProgress(target, season, episode);
    if (!myList.find(m => m.tmdbId === target.tmdbId)) addToList(target, "in-corso");
  };

  const handleCloseUpdates = async () => {
    if (session?.user) {
      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: session.user.id,
            updates_seen_version: UPDATES_VERSION,
            updated_at: new Date().toISOString()
          },
          { onConflict: "id" }
        );
      if (error) console.error("Errore salvataggio novita profilo:", error);
    }
    localStorage.setItem(UPDATES_STORAGE_KEY, UPDATES_VERSION);
    setShowUpdates(false);
  };

  const handleOpenUpdates = () => {
    setShowUpdates(true);
  };

  const getFilteredList = () => {
    let items = [...myList];
    if (listSearch) items = items.filter(m => m.title.toLowerCase().includes(listSearch.toLowerCase()));
    if (listTypeFilter !== "all") items = items.filter(m => m.type === listTypeFilter);
    if (listStatusFilter !== "all") items = items.filter(m => m.status === listStatusFilter);
    items.sort((a, b) => {
      if (listSort === "rating") return b.rating - a.rating;
      if (listSort === "year") return parseInt(b.year || "0") - parseInt(a.year || "0");
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });
    return items;
  };
  const filteredMyList = getFilteredList();

  const isAuthRoute = location.pathname === "/auth";
  const spotlightItem = homeLists.popular[0] || homeLists.trending[0];

  if (!session && !isAuthRoute) return <SiteLock onLogin={() => navigate("/auth")} />;

  return (
    <div className="app">
      {session && (
        <Navbar 
          resetSelection={() => setSelected(null)} 
          query={query} setQuery={setQuery} onSearch={runSearch}
          session={session} onLogout={handleLogout} onShowUpdates={handleOpenUpdates} isAdmin={isAdmin}
        />
      )}

      {/* TASTO SHUFFLE */}
      {false && (
         <button className="shuffle-btn" title="Cosa guardo?">🎲</button>
      )}

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
                    <AdminDashboard currentUserId={session?.user?.id || ""} onAdminStateChange={setIsAdmin} />
                  </PageTransition>
                </DeferredSection>
              </RequireAdmin>
            }
          />

          <Route path="/" element={
            <RequireAuth session={session}><PageTransition>
              <>
                {selected ? (
                  <>
                    <Hero 
                      item={selected} 
                      myList={myList} 
                      progress={getProgress(selected.tmdbId)}
                      onPlay={(s, e) => handlePlay(s, e)} 
                      onAddToList={handleAddToList} 
                      onRate={handleRate}
                      onRemoveFromList={() => removeFromList(selected.tmdbId)}
                      onClose={() => setSelected(null)} 
                      onSelectCollectionItem={selectItem} 
                      isUILocked={isUILocked}
                      toggleUILock={toggleUILock}
                    />
                    <CastList cast={cast} onActorSelect={handleActorSelect} />
                    {selectedActor && (
                      <div className="list-section" style={{ marginTop: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                          <h2>Film con {selectedActor.name}</h2>
                          <button className="pill ghost" onClick={() => { setSelectedActor(null); setActorCredits([]); }}>Chiudi</button>
                        </div>
                        {actorCredits.length > 0 ? (
                          <motion.div layout className="grid">
                            <AnimatePresence mode="popLayout">
                              {actorCredits.map(item => (
                                <motion.div 
                                  layout
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  transition={{ duration: 0.3 }}
                                  key={item.tmdbId}
                                >
                                  <Card item={item} onClick={() => selectItem(item)} />
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </motion.div>
                        ) : (
                          <p style={{ color: '#888' }}>Nessun film trovato.</p>
                        )}
                      </div>
                    )}
                    {related.length > 0 && (
                      <div className="list-section" style={{ marginTop: '20px' }}>
                         <div className="carousel-header" style={{ marginBottom: '20px', paddingLeft: '0' }}>
                            <span className="carousel-icon">💡</span>
                            <h3 className="carousel-title">Perchè hai scelto "{selected.title}"</h3>
                         </div>
                         <motion.div layout className="grid">
                           <AnimatePresence mode="popLayout">
                              {related.map(item => (
                                  <motion.div 
                                    layout
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.3 }}
                                    key={item.tmdbId}
                                  >
                                    <Card item={item} onClick={() => selectItem(item)} />
                                  </motion.div>
                              ))}
                           </AnimatePresence>
                         </motion.div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {results.length > 0 ? (
                      <div className="list-section" style={{ marginTop: '20px' }}>
                          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                              <h2>Risultati Ricerca "{query}"</h2>
                              <button className="pill ghost" onClick={() => { setResults([]); setQuery(""); }}>Chiudi ricerca X</button>
                          </div>
                          <motion.div layout className="grid">
                            <AnimatePresence mode="popLayout">
                              {results.map(item => (
                                  <motion.div 
                                    layout
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.3 }}
                                    key={item.tmdbId}
                                  >
                                    <Card item={item} onClick={() => selectItem(item)} />
                                  </motion.div>
                              ))}
                            </AnimatePresence>
                          </motion.div>
                      </div>
                    ) : (
                      <div style={{ marginTop: '20px' }}>
                        <HomeSpotlight
                          item={spotlightItem}
                          onSelect={selectItem}
                          onPlay={(item) => handlePlay(1, 1, item)}
                        />

                        <div className="home-content-overlap" style={{ position: 'relative', zIndex: 10, marginTop: '-12vh', paddingBottom: '20px' }}>
                          {session && <CommunityPulse onItemClick={selectItem} />}

                          {session && myList.some(m => m.status === 'in-corso') && (
                              <CarouselSection
                                title="Continua a guardare"
                                icon="✋"
                                items={myList.filter(m => m.status === 'in-corso').map(m => m as TmdbItem)}
                                onSelect={selectItem}
                                getProgress={getProgress}
                              />
                          )}

                          {session && <CommunityShelf onSelect={selectItem} />}
                          
                          <CarouselSection title="I titoli del momento" icon="🔥" items={homeLists.popular} onSelect={selectItem} />
                          <CarouselSection title="Aggiunti di recente" icon="🆕" items={homeLists.newReleases} onSelect={selectItem} />
                          <CarouselSection title="Top 10 titoli di oggi" icon="📈" items={homeLists.trending.slice(0, 10)} onSelect={selectItem} />
                          <CarouselSection title="In arrivo" icon="📅" items={homeLists.upcoming} onSelect={selectItem} isUpcoming={true} formatDate={formatDate} />
                          <CarouselSection title="Dramma" icon="🎭" items={homeLists.drama} onSelect={selectItem} />
                          <CarouselSection title="Azione e Avventura" icon="💣" items={homeLists.action} onSelect={selectItem} />
                          <CarouselSection title="Animazione" icon="✨" items={homeLists.animation} onSelect={selectItem} />
                          <CarouselSection title="Horror" icon="🕯️" items={homeLists.horror} onSelect={selectItem} />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            </PageTransition></RequireAuth>
          } />

          <Route path="/archive" element={<RequireAuth session={session}><DeferredSection><PageTransition><Archive onSelect={selectItem} /></PageTransition></DeferredSection></RequireAuth>} />
          
          <Route path="/list" element={
            <RequireAuth session={session}>
              <PageTransition><div style={{paddingTop: '20px'}}>
                  <div className="list-page-header">
                     <h1>La mia lista</h1>
                     <p style={{opacity:0.6}}>Gestisci i tuoi titoli salvati.</p>
                  </div>
                  <div className="filter-bar" style={{ marginBottom: '40px' }}>
                     <div className="filter-group"><span className="filter-label">Cerca</span><input className="filter-select" placeholder="Titolo..." value={listSearch} onChange={e => setListSearch(e.target.value)} style={{ width:'200px', cursor:'text', backgroundImage:'none' }}/></div>
                     <div className="filter-group"><span className="filter-label">Tipologia</span><select className="filter-select" value={listTypeFilter} onChange={e => setListTypeFilter(e.target.value as any)}><option value="all">Tutti</option><option value="movie">Film</option><option value="tv">Serie TV</option></select></div>
                     <div className="filter-group"><span className="filter-label">Stato</span><select className="filter-select" value={listStatusFilter} onChange={e => setListStatusFilter(e.target.value as any)}><option value="all">Tutti gli stati</option>{STATUS_SECTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
                     <div className="filter-group"><span className="filter-label">Ordina per</span><select className="filter-select" value={listSort} onChange={e => setListSort(e.target.value as any)}><option value="added">Data aggiunta</option><option value="rating">Voto Personale</option><option value="year">Anno Uscita</option></select></div>
                  </div>
                  {listLoading && (
                      <div className="grid">
                         {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
                      </div>
                  )}
                  {STATUS_SECTIONS.map(sec => {
                      if (listStatusFilter !== "all" && listStatusFilter !== sec.id) return null;
                      const sectionItems = filteredMyList.filter(m => m.status === sec.id);
                      if (sectionItems.length === 0) return null;
                      const movies = sectionItems.filter(m => m.type === "movie");
                      const tvShows = sectionItems.filter(m => m.type === "tv");
                      return (
                          <div key={sec.id} className="list-section" style={{ marginBottom: '60px' }}>
                              <div className="list-section-header"><h2 className="list-section-title">{sec.label} <span style={{fontSize:'0.6em', opacity:0.5, marginLeft:'10px', verticalAlign:'middle'}}>({sectionItems.length})</span></h2></div>
                              <div className="grid">
                                 {[...movies, ...tvShows].map(item => (
                                   <Card
                                     key={item.tmdbId}
                                     item={item}
                                     onClick={() => selectItem(item)}
                                     onRemove={() => removeFromList(item.tmdbId)}
                                     showRating={true}
                                     progress={getProgress(item.tmdbId)}
                                     onTypeChange={isAdmin ? (nextType) => updateMediaType(item.tmdbId, nextType) : undefined}
                                   />
                                 ))}
                              </div>
                          </div>
                      );
                  })}
              </div>
              </PageTransition>
            </RequireAuth>
          } />

          {/* --- CLASSIFICA --- */}
          <Route path="/ranking" element={<RequireAuth session={session}><DeferredSection><PageTransition><Ranking /></PageTransition></DeferredSection></RequireAuth>} />

          <Route path="/suggestions" element={<RequireAuth session={session}><DeferredSection><PageTransition><Suggestions onSelect={selectItem} session={session} /></PageTransition></DeferredSection></RequireAuth>} />

        </Routes>
      </AnimatePresence>

      {session && showPlayer && playerState && selected && (
        <DeferredOverlay>
          <PlayerDrawer 
            item={selected} 
            season={playerState.season} 
            episode={playerState.episode} 
            onClose={() => { setTrailerPlaybackBlocked(false); setShowPlayer(false); setIsPipMode(false); }}
            isPipMode={isPipMode}
            onTogglePip={() => setIsPipMode(!isPipMode)}
            onNavigateEpisode={(s: number, e: number) => handlePlay(s, e, selected)}
          />
        </DeferredOverlay>
      )}

      {unavailableItem && (
        <div className="modal-backdrop-glass" onClick={() => setUnavailableItem(null)}>
          <div className="modal-glass-box" onClick={(e) => e.stopPropagation()}>
            <h3>Film {unavailableItem.title} ancora non disponibile</h3>
            <p>Non è ancora uscito o non è presente nel catalogo streaming.</p>
            <button className="pill solid" onClick={() => setUnavailableItem(null)}>Ok</button>
          </div>
        </div>
      )}

      {showUpdates && (
        <DeferredSection>
          <UpdatesModal items={updatesItems} version={UPDATES_VERSION} onClose={handleCloseUpdates} />
        </DeferredSection>
      )}
    </div>
  );
}
