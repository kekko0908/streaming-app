import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { TmdbItem, SuggestionItem } from '../types/types';
import { searchTmdb } from '../utils/api';
import Card from './Card';
import { useStore } from '../hooks/useStore';

interface Props {
  onSelect: (item: TmdbItem) => void;
  session: any;
}

export default function Suggestions({ onSelect, session }: Props) {
  const { myList } = useStore();
  
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Stati Interfaccia
  const [mode, setMode] = useState<'view' | 'add'>('view');
  const [searchSource, setSearchSource] = useState<'global' | 'list'>('global');
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbItem[]>([]);
  
  // Stati Form & Azioni
  const [selectedItem, setSelectedItem] = useState<TmdbItem | null>(null);
  const [comment, setComment] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  useEffect(() => {
    fetchSuggestions();
  }, [mode]);

  useEffect(() => {
    if (mode === 'add' && searchSource === 'list') {
      setResults(myList);
      setQuery("");
    }
  }, [searchSource, mode, myList]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchSuggestions = async () => {
    setLoading(true);
    const { data } = await supabase.from('suggestions').select('*').order('created_at', { ascending: false });
    setSuggestions(data || []);
    setLoading(false);
  };

  const handleSearch = async (term: string) => {
    setQuery(term);
    if (!term.trim()) {
       if (searchSource === 'list') setResults(myList);
       else setResults([]);
       return;
    }
    if (searchSource === 'global') {
      const [m, t] = await Promise.all([searchTmdb(term, "movie"), searchTmdb(term, "tv")]);
      setResults([...m, ...t].slice(0, 12)); 
    } else {
      setResults(myList.filter(i => i.title.toLowerCase().includes(term.toLowerCase())));
    }
  };

  const getMaskedName = (fullName: string | undefined, email: string | undefined) => {
    let name = fullName || email?.split('@')[0] || "Utente";
    return name.length > 3 ? name.substring(0, 3) + "***" : name + "***";
  };

  const submitSuggestion = async () => {
    if (!selectedItem || !session) return;
    
    const userMeta = session.user.user_metadata;
    const rawName = userMeta.full_name || session.user.email?.split('@')[0] || "Anonimo";
    const avatarUrl = userMeta.avatar_url || userMeta.picture || null;

    const { error } = await supabase.from('suggestions').insert([{
      user_id: session.user.id,
      tmdb_id: selectedItem.tmdbId,
      media_type: selectedItem.type,
      tmdb_data: selectedItem,
      comment: comment.slice(0, 100),
      user_name: rawName,
      user_avatar: avatarUrl
    }]);

    if (!error) {
      setMode('view');
      setSelectedItem(null);
      setComment("");
      showToast("Consiglio pubblicato! 🎉", "success");
    } else {
      showToast("Errore durante la pubblicazione.", "error");
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const { error } = await supabase.from('suggestions').delete().eq('id', itemToDelete).eq('user_id', session.user.id);
    if (error) {
      showToast("Impossibile eliminare.", "error");
    } else {
      setSuggestions(prev => prev.filter(item => item.id !== itemToDelete));
      showToast("Eliminato correttamente.", "success");
    }
    setItemToDelete(null);
  };

  // --- FILTRO PER CATEGORIE ---
  const movies = suggestions.filter(s => s.tmdb_data.type === 'movie');
  const tvShows = suggestions.filter(s => s.tmdb_data.type === 'tv');

  // Helper per renderizzare una sezione
  const renderSection = (title: string, items: SuggestionItem[], type: 'movie' | 'tv') => (
    <div className="wall-section">
      <div className={`neon-header ${type}`}>
        {title} <span className="header-count">{items.length}</span>
      </div>
      
      {items.length === 0 ? (
        <p style={{ opacity: 0.4, fontStyle: 'italic' }}>Nessun consiglio in questa categoria.</p>
      ) : (
        <div className="grid">
          {items.map(s => (
            <div key={s.id} className="suggestion-card-wrapper">
              {s.comment && <div className="suggestion-bubble">"{s.comment}"</div>}
              <Card item={s.tmdb_data} onClick={() => onSelect(s.tmdb_data)} />
              
              {session && session.user.id === s.user_id && (
                <div className="delete-btn-overlay" onClick={(e) => { e.stopPropagation(); setItemToDelete(s.id); }} title="Elimina">
                  🗑️
                </div>
              )}
              
              <div className="suggester-badge">
                 {s.user_avatar ? <img src={s.user_avatar} alt="user" style={{width:'20px', height:'20px', borderRadius:'50%', objectFit:'cover'}} /> : <span>👤</span>}
                 <span>{getMaskedName(s.user_name, undefined)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ paddingBottom: '50px' }}>
      
      {toast && <div className={`toast-notification ${toast.type}`}>{toast.type === 'success' ? '✅' : '❌'} {toast.msg}</div>}

      {itemToDelete && (
        <div className="modal-backdrop-glass" onClick={() => setItemToDelete(null)}>
          <div className="modal-glass-box" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🗑️</div>
            <h3>Elimina Consiglio</h3>
            <p>Rimuovere definitivamente dalla bacheca?</p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button className="pill ghost" onClick={() => setItemToDelete(null)}>No</button>
              <button className="pill solid" style={{ background: '#ff0050', borderColor: '#ff0050', color: '#fff' }} onClick={confirmDelete}>Sì, elimina</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1>Community Wall 💡</h1>
        <p style={{ opacity: 0.6 }}>Il meglio del cinema e della TV scelto da voi.</p>
      </div>

      <div className="suggestions-nav">
        {mode === 'view' ? (
          <>
            <button className="pill ghost" onClick={fetchSuggestions}>🔄 Aggiorna</button>
            {session ? (
              <button className="pill solid" onClick={() => { setMode('add'); setSearchSource('global'); setResults([]); setQuery(""); }}>+ Consiglia Tu</button>
            ) : (
              <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Accedi per consigliare</span>
            )}
          </>
        ) : (
          <>
             <button className={`pill ${searchSource === 'global' ? 'active' : 'ghost'}`} onClick={() => { setSearchSource('global'); setResults([]); setQuery(""); }}>🌐 Global</button>
             <button className={`pill ${searchSource === 'list' ? 'active' : 'ghost'}`} onClick={() => setSearchSource('list')}>📑 La mia Lista</button>
             <input autoFocus placeholder={searchSource === 'global' ? "Cerca..." : "Filtra lista..."} value={query} onChange={(e) => handleSearch(e.target.value)} />
             <button className="pill ghost danger" onClick={() => { setMode('view'); setSelectedItem(null); }}>Annulla</button>
          </>
        )}
      </div>

      {mode === 'add' && (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          {!selectedItem ? (
            <div className="grid">
              {results.length === 0 && searchSource === 'list' && myList.length === 0 && (
                  <p style={{gridColumn:'1/-1', textAlign:'center', padding:'20px', opacity:0.5}}>La tua lista è vuota!</p>
              )}
              {results.map(item => (
                <div key={item.tmdbId} onClick={() => setSelectedItem(item)} style={{ cursor:'pointer', opacity: 0.85, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}>
                   <Card item={item} onClick={() => setSelectedItem(item)} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s' }}>
               <h3 style={{ color: 'var(--primary)', marginBottom:'20px' }}>Perché consigli "{selectedItem.title}"?</h3>
               <div style={{display:'flex', gap:'30px', justifyContent:'center', alignItems:'flex-start', margin:'0 auto', maxWidth:'800px'}}>
                   <div style={{width:'180px', flexShrink:0}}><Card item={selectedItem} onClick={()=>{}}/></div>
                   <div style={{flex:1, display:'flex', flexDirection:'column', gap:'15px'}}>
                     <textarea className="suggestion-glass-textarea" rows={4} placeholder="Scrivi qui la tua recensione... (Max 100 car.)" maxLength={100} value={comment} onChange={e => setComment(e.target.value)} />
                     <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button className="pill ghost" onClick={() => setSelectedItem(null)}>Indietro</button>
                        <button className="pill solid" onClick={submitSuggestion}>Pubblica 🚀</button>
                     </div>
                   </div>
               </div>
            </div>
          )}
        </div>
      )}

      {/* --- VISTA SEZIONI SEPARATE --- */}
      {mode === 'view' && (
        loading ? <p style={{textAlign:'center'}}>Caricamento...</p> : (
          <div style={{ marginTop: '20px' }}>
            {/* Sezione FILM */}
            {renderSection("Film Consigliati 🎬", movies, 'movie')}
            
            {/* Spaziatore visivo opzionale */}
            <div style={{ height: '40px' }}></div>

            {/* Sezione SERIE TV */}
            {renderSection("Serie TV Consigliate 📺", tvShows, 'tv')}
          </div>
        )
      )}
    </div>
  );
}