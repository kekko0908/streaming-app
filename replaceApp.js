const fs = require('fs');
const path = 'c:/Users/User/Desktop/LAVORO/Streaming_for_all/streaming-app/src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

const startIdx = content.indexOf('  return (\n    <div className="app">');
const endIdx = content.lastIndexOf('  );\n}');

if (startIdx !== -1 && endIdx !== -1) {
  const newReturn = `  return (
    <div className="app">
      <Navbar 
        resetSelection={() => setSelected(null)} 
        query={query} setQuery={setQuery} onSearch={runSearch}
        session={session} onLogout={handleLogout} onShowUpdates={handleOpenUpdates}
      />

      <Routes>
        <Route path="/auth" element={!session ? <AuthForm /> : <Navigate to="/" />} />
        <Route path="/profile" element={session ? <Profile /> : <Navigate to="/auth" />} />
        <Route path="/archive" element={<Archive onSelect={selectItem} />} />
        
        <Route path="/list" element={
          session ? (
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
          ) : (
            <div style={{textAlign:'center', padding:'50px'}}><h2>Accesso Negato</h2><button className="pill solid" onClick={() => navigate('/auth')}>Vai al Login</button></div>
          )
        } />
        
        <Route path="/ranking" element={
          session ? <Ranking /> : (
            <div style={{textAlign:'center', padding:'50px'}}>
              <h2>Community Riservata</h2>
              <p style={{marginBottom:'20px', color:'#aaa'}}>Accedi per visualizzare le classifiche, sfidare gli amici e vedere i "Critici Top".</p>
              <button className="pill solid" onClick={() => navigate('/auth')}>Vai al Login</button>
            </div>
          )
        } />

        <Route path="/suggestions" element={<Suggestions onSelect={selectItem} session={session} />} />

        <Route path="/" element={
          <>
            {!selected && (
               <button className="shuffle-btn" onClick={openShuffleMenu} title="Cosa guardo?">🎲</button>
            )}

            {selected ? (
              <>
                  <Hero 
                    item={selected} myList={myList} progress={getProgress(selected.tmdbId)}
                    onPlay={handlePlay} onAddToList={handleAddToList} onRate={handleRate}
                    onRemoveFromList={() => removeFromList(selected.tmdbId)}
                    onClose={() => setSelected(null)} onSelectCollectionItem={selectItem} 
                  />
                  <CastList cast={cast} onActorSelect={handleActorSelect} />
                  {selectedActor && (
                      <div className="list-section" style={{ marginTop: '20px' }}>
                           <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                              <h2>Film con {selectedActor.name}</h2>
                              <button className="pill ghost" onClick={() => { setSelectedActor(null); setActorCredits([]); }}>Chiudi</button>
                           </div>
                           {actorCredits.length > 0 ? (
                             <div className="grid">
                                {actorCredits.map(item => (
                                    <Card key={item.tmdbId} item={item} onClick={() => selectItem(item)} />
                                ))}
                             </div>
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
        } />
      </Routes>

      {showShuffleFilter && (
         <ShuffleFilterModal 
            onSelectGenre={runSmartShuffle}
            onClose={() => setShowShuffleFilter(false)}
            loading={shuffleLoading}
         />
      )}

      {shuffleItem && (
         <ShuffleModal 
            item={shuffleItem} 
            onPlay={handleShufflePlay} 
            onRetry={handleRetryShuffle} 
            onClose={() => setShuffleItem(null)} 
         />
      )}

      {showPlayer && selected && (
        <PlayerDrawer
          item={selected}
          season={playerState.season}
          episode={playerState.episode}
          onClose={() => setShowPlayer(false)}
        />
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
        <UpdatesModal items={updatesItems} version={UPDATES_VERSION} onClose={handleCloseUpdates} />
      )}
\`;
  content = content.substring(0, startIdx) + newReturn + '\n' + content.substring(endIdx);
  fs.writeFileSync(path, content);
  console.log('App.tsx string replace successful');
} else {
  console.log('Could not find boundaries');
}
