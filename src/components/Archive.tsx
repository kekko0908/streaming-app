import { useState, useEffect } from "react";
import "../css/archive.css";
import "../css/card.css";
import { MediaType, TmdbItem } from "../types/types";
import { discoverContent } from "../utils/api";
import Card from "./Card";

interface ArchiveProps {
  onSelect: (item: TmdbItem) => void;
}

export default function Archive({ onSelect }: ArchiveProps) {
  const [type, setType] = useState<MediaType>("movie");
  const [sort, setSort] = useState("popularity.desc");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [year, setYear] = useState("");
  const [vote, setVote] = useState("");
  
  const [results, setResults] = useState<TmdbItem[]>([]);
  const [page, setPage] = useState(1); // Pagina di partenza attuale
  const [loading, setLoading] = useState(false);
  const [isGenreOpen, setIsGenreOpen] = useState(false);

  // QUANTE PAGINE SCARICARE ALLA VOLTA (3 pagine = 60 film)
  const PAGES_PER_LOAD = 3;

  const genres = [
    { id: "28", name: "Azione" },
    { id: "12", name: "Avventura" },
    { id: "16", name: "Animazione" },
    { id: "35", name: "Commedia" },
    { id: "80", name: "Crime" },
    { id: "18", name: "Dramma" },
    { id: "14", name: "Fantasy" },
    { id: "27", name: "Horror" },
    { id: "9648", name: "Mistero" },
    { id: "10749", name: "Romantico" },
    { id: "878", name: "Fantascienza" },
    { id: "53", name: "Thriller" },
    { id: "10752", name: "Guerra" },
    { id: "37", name: "Western" },
  ];

  const sorts = [
    { id: "popularity.desc", name: "Più Popolari" },
    { id: "primary_release_date.desc", name: "Data di Uscita" },
    { id: "vote_average.desc", name: "Valutazione Migliore" },
    { id: "revenue.desc", name: "Incassi" },
  ];

  // 1. Reset quando cambiano i filtri
  useEffect(() => {
    setPage(1);
    loadResults(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, sort, selectedGenres, year, vote]);

  // 2. Funzione di caricamento POTENZIATA (Multi-pagina)
  async function loadResults(startPage: number, reset: boolean) {
    setLoading(true);
    try {
      const genreString = selectedGenres.join(",");
      
      // Creiamo un array di promesse per scaricare 3 pagine in parallelo
      // Es: Se startPage è 1, scarichiamo 1, 2, 3.
      const promises = [];
      for (let i = 0; i < PAGES_PER_LOAD; i++) {
        promises.push(discoverContent(type, sort, genreString, year, vote, startPage + i));
      }

      // Attendiamo tutte le risposte
      const responses = await Promise.all(promises);
      
      // Uniamo tutti i risultati in un unico array
      const newItems = responses.flat();

      if (reset) {
        // Se è un reset, prendiamo direttamente i nuovi
        setResults(newItems);
      } else {
        // Se è un "carica altri", aggiungiamo in coda evitando duplicati
        setResults(prev => {
          const combined = [...prev, ...newItems];
          // Rimuovi duplicati basandoti su tmdbId
          const uniqueMap = new Map(combined.map(item => [item.tmdbId, item]));
          return Array.from(uniqueMap.values());
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // 3. Gestore "Carica Altri"
  const handleLoadMore = () => {
    // La prossima pagina di partenza sarà quella attuale + il blocco caricato
    const nextPage = page + PAGES_PER_LOAD;
    setPage(nextPage);
    loadResults(nextPage, false);
  };

  const toggleGenre = (id: string) => {
    if (selectedGenres.includes(id)) {
      setSelectedGenres(prev => prev.filter(g => g !== id));
    } else {
      setSelectedGenres(prev => [...prev, id]);
    }
  };

  return (
    <div className="archive-container">
      <div className="archive-header">
        <h1>Archivio Completo</h1>
        
        <div className="filter-bar">
          <div className="filter-group">
             <span className="filter-label">Tipo</span>
             <select className="filter-select" value={type} onChange={e => setType(e.target.value as MediaType)}>
               <option value="movie">Film</option>
               <option value="tv">Serie TV</option>
             </select>
          </div>

          <div className="filter-group">
             <span className="filter-label">Genere</span>
             <button className="filter-trigger" onClick={() => setIsGenreOpen(!isGenreOpen)} style={{ width: '180px' }}>
                {selectedGenres.length === 0 ? "Tutti i generi" : `${selectedGenres.length} selezionati`}
                <span style={{ fontSize: '0.7em', marginLeft:'5px' }}>▼</span>
             </button>
             {isGenreOpen && (
               <>
                 <div className="dropdown-backdrop" onClick={() => setIsGenreOpen(false)} />
                 <div className="dropdown-menu">
                    {genres.map(g => {
                      const isSelected = selectedGenres.includes(g.id);
                      return (
                        <div key={g.id} className={`dropdown-item ${isSelected ? 'selected' : ''}`} onClick={() => toggleGenre(g.id)}>
                          <div className="checkbox-circle" />
                          {g.name}
                        </div>
                      );
                    })}
                 </div>
               </>
             )}
          </div>

          <div className="filter-group">
             <span className="filter-label">Anno</span>
             <select className="filter-select" value={year} onChange={e => setYear(e.target.value)}>
               <option value="">Tutti</option>
               <option value="2025">2025</option>
               <option value="2024">2024</option>
               <option value="2023">2023</option>
               <option value="2022">2022</option>
               <option value="2020">Anni 2020</option>
               <option value="2010">Anni 2010</option>
               <option value="2000">Anni 2000</option>
               <option value="1990">Anni 90</option>
             </select>
          </div>

          <div className="filter-group">
             <span className="filter-label">Voto Minimo</span>
             <select className="filter-select" value={vote} onChange={e => setVote(e.target.value)}>
               <option value="">Qualsiasi</option>
               <option value="8">8+ (Ottimi)</option>
               <option value="7">7+ (Buoni)</option>
               <option value="6">6+ (Sufficienti)</option>
             </select>
          </div>

          <div className="filter-group">
             <span className="filter-label">Ordina Per</span>
             <select className="filter-select" value={sort} onChange={e => setSort(e.target.value)}>
               {sorts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
          </div>
        </div>

        <div className="archive-stats">
            <span>{results.length} titoli visualizzati</span>
        </div>
      </div>

      <div className="grid">
          {results.map((item, index) => (
             <Card 
               key={`${item.tmdbId}-${index}`} 
               item={item} 
               onClick={() => onSelect(item)} 
               showRating={true}
             />
          ))}
      </div>
      
      <div className="load-more-container">
         <button className="pill solid" onClick={handleLoadMore} disabled={loading} style={{ padding: '12px 40px', fontSize: '1.1rem' }}>
           {loading ? "Caricamento (3 pagine)..." : "Carica altri titoli (+60)"}
         </button>
      </div>
    </div>
  );
}