import { useEffect, useState } from "react";
import "./css/global.css";
import "./css/archive.css"; 
import "./css/shuffle.css"; 
import Ranking from "./components/Ranking";
import Suggestions from "./components/Suggestions";
import { ViewType, TmdbItem, STATUS_SECTIONS, WatchStatus } from "./types/types";
import { 
  fetchCollection, 
  searchTmdb, 
  fetchDetails, 
  fetchByGenre, 
  fetchPopularTV,
  fetchRecommendations,
  fetchCredits, 
  CastMember    
} from "./utils/api";
import { useStore } from "./hooks/useStore";
import { supabase } from "./supabaseClient";
import { Session } from "@supabase/supabase-js";

// Components
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Card from "./components/Card";
import PlayerDrawer from "./components/PlayerDrawer";
import CarouselSection from "./components/CarouselSection"; 
import Archive from "./components/Archive";
import AuthForm from "./components/AuthForm";
import CastList from "./components/CastList"; 
import Profile from "./components/Profile";
import CommunityPulse from "./components/CommunityPulse"; 
import SiteLock from "./components/SiteLock"; 
import ShuffleModal from "./components/ShuffleModal"; 
import ShuffleFilterModal from "./components/ShuffleFilterModal"; 

export default function App() {
  const [isSiteUnlocked, setIsSiteUnlocked] = useState(() => {
    return sessionStorage.getItem("site_unlocked") === "true";
  });

  const [view, setView] = useState<ViewType>("home");
  const [session, setSession] = useState<Session | null>(null);

  const { myList, addToList, removeFromList, updateProgress, getProgress, rateItem, loading: listLoading } = useStore();

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
  const [showPlayer, setShowPlayer] = useState(false);
  const [playerState, setPlayerState] = useState({ season: 1, episode: 1 });

  // --- STATI SHUFFLE ---
  const [shuffleItem, setShuffleItem] = useState<TmdbItem | null>(null);
  const [showShuffleFilter, setShowShuffleFilter] = useState(false);
  const [shuffleLoading, setShuffleLoading] = useState(false);
  const [activeShuffleGenre, setActiveShuffleGenre] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (view === 'auth' && session) setView('home');
      if (!session && (view === 'list' || view === 'profile')) setView('home');
    });
    return () => subscription.unsubscribe();
  }, [view]);

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
          fetchCollection("movie/now_playing") 
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
  }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); setSession(null); setView("home"); };

  const runSearch = async () => {
    if (!query) return;
    try {
      const [movies, tv] = await Promise.all([searchTmdb(query, "movie"), searchTmdb(query, "tv")]);
      const flat = [...movies, ...tv].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      setResults(flat); setView("home"); setSelected(null); setRelated([]);
    } catch (e) { console.error(e); }
  };

  const selectItem = async (item: TmdbItem) => {
    setView("home"); setShowPlayer(false); window.scrollTo({ top: 0, behavior: "smooth" });
    const fullItem = await fetchDetails(item.tmdbId, item.type);
    setSelected(fullItem);
    try { const recs = await fetchRecommendations(item.tmdbId, item.type); setRelated(recs); } catch(e) { setRelated([]); }
    try { const actors = await fetchCredits(item.tmdbId, item.type); setCast(actors); } catch(e) { setCast([]); }
  };

  // --- LOGICA SHUFFLE BLINDATA ---
  
  const openShuffleMenu = () => {
    setShowShuffleFilter(true);
    setShuffleItem(null);
    setActiveShuffleGenre(null);
  };
const runSmartShuffle = async (genreId: number | null) => {
    setShuffleLoading(true);
    setActiveShuffleGenre(genreId);

    try {
        let pool: TmdbItem[] = [];

        if (genreId === null) {
            // "SORPRENDIMI": Usa tutto quello che abbiamo in cache
            pool = [
                ...(homeLists.trending || []),
                ...(homeLists.popular || []),
                ...(homeLists.action || []),
                ...(homeLists.newReleases || []),
                ...(homeLists.animation || [])
            ];
        } else {
            // GENERE SPECIFICO: Scarica una pagina random (1-5)
            // Nota: fetchByGenre ora scarica film freschi
            pool = await fetchByGenre(genreId, "movie"); 
        }

        // --- FILTRAGGIO INTELLIGENTE ---
        
        // 1. Pulizia base: Rimuovi film senza poster o rotti
        let cleanPool = pool.filter(m => m && (m.poster));

        // 2. Filtro "QUALITY CONTROL": Cerchiamo solo film con voto >= 7
        const highQualityPool = cleanPool.filter(m => (m.rating || 0) >= 7);

        // 3. Selezione del pool finale
        // Se abbiamo trovato capolavori (voto >= 7), usiamo quelli.
        // Altrimenti, per non dare errore, usiamo il pool pulito (i migliori disponibili).
        let finalPool = highQualityPool.length > 0 ? highQualityPool : cleanPool;

        if (finalPool.length > 0) {
            // Pesca il vincitore
            const randomIndex = Math.floor(Math.random() * finalPool.length);
            const winner = finalPool[randomIndex];
            
            setShuffleItem(winner);
            setShowShuffleFilter(false);
        } else {
            // Fallback estremo se proprio non c'è nulla
            alert("Nessun film trovato! Riprova.");
        }

    } catch (error) {
        console.error("Errore shuffle", error);
        alert("Errore tecnico nel caricamento.");
    } finally {
        setShuffleLoading(false);
    }
  };
 
  const handleShufflePlay = () => {
    if (shuffleItem) {
        setShuffleItem(null); 
        selectItem(shuffleItem); 
    }
  };

  const handleRetryShuffle = () => {
      runSmartShuffle(activeShuffleGenre);
  };

  // --- RESTO APP ---

  const handleAddToList = (status: any) => {
    if (!session) { alert("Devi accedere!"); setView("auth"); return; }
    if (selected) addToList(selected, status);
  };
  const handleRate = (rating: number) => {
    if (!session) { alert("Devi accedere!"); return; }
    if (selected) rateItem(selected, rating);
  };
  const handlePlay = (season: number, episode: number) => {
    if (!selected) return;
    setPlayerState({ season, episode });
    setShowPlayer(true);
    if (session) {
        updateProgress(selected, season, episode);
        if (!myList.find(m => m.tmdbId === selected.tmdbId)) addToList(selected, "in-corso");
    }
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
        view={view} setView={setView} resetSelection={() => setSelected(null)} 
        query={query} setQuery={setQuery} onSearch={runSearch}
        session={session} onLogout={handleLogout}
      />

      {view === "auth" && <AuthForm />}
      {view === "profile" && session && <Profile />}

      {view === "home" && (
        <>
          {selected ? (
            <>
                <Hero 
                  item={selected} myList={myList} progress={getProgress(selected.tmdbId)}
                  onPlay={handlePlay} onAddToList={handleAddToList} onRate={handleRate}
                  onRemoveFromList={() => removeFromList(selected.tmdbId)}
                  onClose={() => setSelected(null)} onSelectCollectionItem={selectItem} 
                />
                <CastList cast={cast} />
                {related.length > 0 && (
                    <div className="list-section" style={{ marginTop: '20px' }}>
                         <div className="carousel-header" style={{ marginBottom: '20px', paddingLeft: '0' }}>
                            <span className="carousel-icon">💡</span>
                            <h3 className="carousel-title">Perchè hai scelto "{selected.title}"</h3>
                         </div>
                         <div className="grid">
                            {related.map(item => (
                                <Card key={item.tmdbId} item={item} onClick={() => selectItem(item)} />
                            ))}
                         </div>
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
                    <div className="grid">
                        {results.map(item => <Card key={item.tmdbId} item={item} onClick={() => selectItem(item)} />)}
                    </div>
                </div>
              ) : (
                <div style={{ marginTop: '20px' }}>
                  {session && <CommunityPulse onItemClick={selectItem} />}
                  
                  {session && myList.some(m => m.status === 'in-corso') && (
                      <CarouselSection title="Continua a guardare" icon="✋" items={myList.filter(m => m.status === 'in-corso').map(m => m as TmdbItem)} onSelect={selectItem} />
                  )}
                  
                  <CarouselSection title="Nuove Uscite al Cinema" icon="🆕" items={homeLists.newReleases} onSelect={selectItem} />
                  <CarouselSection title="Popolari su TMDB" icon="🔥" items={homeLists.popular} onSelect={selectItem} />
                  <CarouselSection title="Serie TV del momento" icon="📺" items={homeLists.tvPopular} onSelect={selectItem} />
                  <CarouselSection title="Prossime Uscite" icon="📅" items={homeLists.upcoming} onSelect={selectItem} />
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
      )}

      {/* TASTO SHUFFLE */}
      {view === 'home' && !selected && (
         <button className="shuffle-btn" onClick={openShuffleMenu} title="Cosa guardo?">🎲</button>
      )}

      {/* MENU FILTRO */}
      {showShuffleFilter && (
         <ShuffleFilterModal 
            onSelectGenre={runSmartShuffle}
            onClose={() => setShowShuffleFilter(false)}
            loading={shuffleLoading}
         />
      )}

      {/* MODALE RISULTATO */}
      {shuffleItem && (
         <ShuffleModal 
            item={shuffleItem} 
            onPlay={handleShufflePlay} 
            onRetry={handleRetryShuffle} 
            onClose={() => setShuffleItem(null)} 
         />
      )}

      {view === "archive" && <Archive onSelect={selectItem} />}
      
      {view === "list" && session && (
         <div style={{paddingTop: '20px'}}>
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
             {listLoading && <p>Sincronizzazione in corso...</p>}
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
                            {[...movies, ...tvShows].map(item => (<Card key={item.tmdbId} item={item} onClick={() => selectItem(item)} onRemove={() => removeFromList(item.tmdbId)} showRating={true} progress={getProgress(item.tmdbId)} />))}
                         </div>
                     </div>
                 );
             })}
         </div>
      )}

      {view === "list" && !session && (
        <div style={{textAlign:'center', padding:'50px'}}><h2>Accesso Negato</h2><button className="pill solid" onClick={() => setView('auth')}>Vai al Login</button></div>
      )}

      {/* --- MOSTRA LA CLASSIFICA SOLO SE LOGGATO --- */}
      {view === "ranking" && session && <Ranking />}

      {/* --- FALLBACK SE L'UTENTE PROVA AD ACCEDERE ALLA CLASSIFICA DA SLOGGATO --- */}
      {view === "ranking" && !session && (
         <div style={{textAlign:'center', padding:'50px'}}>
            <h2>Community Riservata</h2>
            <p style={{marginBottom:'20px', color:'#aaa'}}>Accedi per visualizzare le classifiche, sfidare gli amici e vedere i "Critici Top".</p>
            <button className="pill solid" onClick={() => setView('auth')}>Vai al Login</button>
         </div>
      )}
      {view === "suggestions" && (
   <Suggestions onSelect={selectItem} session={session} />
)}

      {showPlayer && selected && (
        <PlayerDrawer item={selected} season={playerState.season} episode={playerState.episode} onClose={() => setShowPlayer(false)} />
      )}
    </div>
  );
}