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
  fetchPopularTV,
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
import Card, { SkeletonCard } from "./components/Card";
import CarouselSection from "./components/CarouselSection"; 
import CastList from "./components/CastList"; 
import CommunityPulse from "./components/CommunityPulse"; 
import SiteLock from "./components/SiteLock"; 
import type { UpdateItem } from "./components/UpdatesModal";
import { setTrailerPlaybackBlocked } from "./utils/trailerPlayback";

const AuthForm = lazy(() => import("./components/AuthForm"));
const Profile = lazy(() => import("./components/Profile"));
const Archive = lazy(() => import("./components/Archive"));
const Ranking = lazy(() => import("./components/Ranking"));
const Suggestions = lazy(() => import("./components/Suggestions"));
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

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const UPDATES_STORAGE_KEY = "sfa_updates_seen";
  const UPDATES_VERSION = "1.4.1";
  const updatesItems: UpdateItem[] = [
    {
      title: "Film correlati dagli attori",
      text: "Clicca su un attore per vedere subito i film collegati al suo profilo."
    },
    {
      title: "Filtro Servizio in Archivio",
      text: "Ora puoi filtrare per piattaforma di streaming direttamente nei risultati."
    },
    {
      title: "Prossime uscite piu chiare",
      text: "Ogni card mostra la data di uscita senza occupare troppo spazio."
    }
  ];
  const [isSiteUnlocked, setIsSiteUnlocked] = useState(() => {
    return sessionStorage.getItem("site_unlocked") === "true";
  });

  const [session, setSession] = useState<Session | null>(null);

  const { myList, addToList, removeFromList, updateProgress, updateMediaType, getProgress, rateItem, loading: listLoading, isUILocked, toggleUILock } = useStore();
  (window as any).sfaStore = { isUILocked, toggleUILock };
  const isAdmin = session?.user?.id === "1181bb0e-d665-4b31-a71f-125028ea62f8";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbItem[]>([]);
  const [listSearch, setListSearch] = useState("");
  const [listTypeFilter, setListTypeFilter] = useState<"all" | "movie" | "tv">("all");
  const [listStatusFilter, setListStatusFilter] = useState<"all" | WatchStatus>("all");
  const [listSort, setListSort] = useState<"added" | "rating" | "year">("added");

  const [homeLists, setHomeLists] = useState<{ 
    trending: TmdbItem[], upcoming: TmdbItem[], popular: TmdbItem[],
    action: TmdbItem[], animation: TmdbItem[], tvPopular: TmdbItem[],
    newReleases: TmdbItem[]
  }>({ 
    trending: [], upcoming: [], popular: [], action: [], animation: [], tvPopular: [], newReleases: []
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
      if (window.location.pathname === '/auth' && session) navigate('/');
      if (!session && (window.location.pathname === '/list' || window.location.pathname === '/profile')) navigate('/');
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    let isActive = true;
    const loadUpdatesSeen = async () => {
      if (!isSiteUnlocked) return;
      if (session?.user) {
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
        return;
      }
      const seenVersion = localStorage.getItem(UPDATES_STORAGE_KEY);
      if (seenVersion !== UPDATES_VERSION) setShowUpdates(true);
    };
    loadUpdatesSeen();
    return () => {
      isActive = false;
    };
  }, [isSiteUnlocked, session?.user?.id]);

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
    async function loadData() {
      try {
        const [trending, rawUpcoming, popular, action, animation, tvPopular, newReleases] = await Promise.all([
          fetchCollection("trending/all/day"),
          fetchCollection("movie/upcoming"),
          fetchCollection("movie/popular"),
          fetchByGenre(28, "movie"),
          fetchByGenre(16, "movie"),
          fetchPopularTV(),
          fetchNowPlaying("IT") 
        ]);
        
        const today = new Date().toISOString().split('T')[0];
        const realUpcoming = rawUpcoming.filter(item => item.releaseDateFull && item.releaseDateFull > today);
        
        setHomeLists({ 
            trending: trending || [], 
            upcoming: realUpcoming || [], 
            popular: popular || [], 
            action: action || [], 
            animation: animation || [], 
            tvPopular: tvPopular || [], 
            newReleases: newReleases || [] 
        });
      } catch (error) { console.error(error); }
    }
    loadData();

    // Listener globale per Play Diretto dalle Card
    const handlePlayDirect = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const { item, season, episode } = customEvent.detail;
      
      try {
        const fullItem = await fetchDetails(item.tmdbId, item.type);
        if (typeof item.progressMinutes === "number") fullItem.progressMinutes = item.progressMinutes;
        setSelected(fullItem);
        const startAt = (fullItem.progressSeconds && fullItem.progressSeconds > 15) ? fullItem.progressSeconds : 0;
        setTrailerPlaybackBlocked(true);
        setPlayerState({ season, episode, startAt });
        setShowPlayer(true);
        
        // Se non abbiamo session, si può comunque vedere
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
             updateProgress(fullItem, season, episode);
          }
        });

      } catch (error) { console.error("Errore Play Diretto", error); }
    };
    window.addEventListener("play_direct", handlePlayDirect);

    return () => {
      window.removeEventListener("play_direct", handlePlayDirect);
    };
  }, []);

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
    localStorage.setItem(UPDATES_STORAGE_KEY, UPDATES_VERSION);
    setSession(null);
    navigate("/");
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
    if (session) {
        updateProgress(target, season, episode);
        if (!myList.find(m => m.tmdbId === target.tmdbId)) addToList(target, "in-corso");
    }
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

  if (!isSiteUnlocked) return <SiteLock onUnlock={() => setIsSiteUnlocked(true)} />;

  return (
    <div className="app">
      <Navbar 
        resetSelection={() => setSelected(null)} 
        query={query} setQuery={setQuery} onSearch={runSearch}
        session={session} onLogout={handleLogout} onShowUpdates={handleOpenUpdates}
      />

      {/* TASTO SHUFFLE */}
      {false && (
         <button className="shuffle-btn" title="Cosa guardo?">🎲</button>
      )}

      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/auth" element={!session ? <DeferredSection><PageTransition><AuthForm /></PageTransition></DeferredSection> : <Navigate to="/" />} />
          <Route path="/profile" element={session ? <DeferredSection><PageTransition><Profile /></PageTransition></DeferredSection> : <Navigate to="/auth" />} />

          <Route path="/" element={
            <PageTransition>
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
                        
                        <CarouselSection title="Nuove Uscite al Cinema" icon="🆕" items={homeLists.newReleases} onSelect={selectItem} />
                        <CarouselSection title="Popolari su TMDB" icon="🔥" items={homeLists.popular} onSelect={selectItem} />
                        <CarouselSection title="Serie TV del momento" icon="📺" items={homeLists.tvPopular} onSelect={selectItem} />
                        <CarouselSection title="Prossime Uscite" icon="📅" items={homeLists.upcoming} onSelect={selectItem} isUpcoming={true} formatDate={formatDate} />
                        <CarouselSection title="Azione e Avventura" icon="💣" items={homeLists.action} onSelect={selectItem} />
                        <CarouselSection title="Animazione" icon="✨" items={homeLists.animation} onSelect={selectItem} />
                        
                        <div className="list-section">
                           <div className="carousel-header"><span className="carousel-icon">📈</span><h3 className="carousel-title">In Tendenza Oggi</h3></div>
                           <div className="grid">
                              {homeLists.trending.slice(0, 18).map(item => (<Card key={item.tmdbId} item={item} onClick={() => selectItem(item)} />))}
                           </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            </PageTransition>
          } />

          <Route path="/archive" element={<DeferredSection><PageTransition><Archive onSelect={selectItem} /></PageTransition></DeferredSection>} />
          
          <Route path="/list" element={
            session ? (
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
            </PageTransition>) : (
              <PageTransition><div style={{textAlign:'center', padding:'50px'}}><h2>Accesso Negato</h2><button className="pill solid" onClick={() => navigate('/auth')}>Vai al Login</button></div></PageTransition>
            )
          } />

          {/* --- CLASSIFICA --- */}
          <Route path="/ranking" element={
            session ? <DeferredSection><PageTransition><Ranking /></PageTransition></DeferredSection> : (
              <PageTransition><div style={{textAlign:'center', padding:'50px'}}>
                <h2>Community Riservata</h2>
                <p style={{marginBottom:'20px', color:'#aaa'}}>Accedi per visualizzare le classifiche, sfidare gli amici e vedere i "Critici Top".</p>
                <button className="pill solid" onClick={() => navigate('/auth')}>Vai al Login</button>
              </div></PageTransition>
            )
          } />

          <Route path="/suggestions" element={<DeferredSection><PageTransition><Suggestions onSelect={selectItem} session={session} /></PageTransition></DeferredSection>} />

        </Routes>
      </AnimatePresence>

      {showPlayer && playerState && selected && (
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
