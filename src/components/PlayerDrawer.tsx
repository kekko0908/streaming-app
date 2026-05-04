/* src/components/PlayerDrawer.tsx */
import { useState, useRef, useEffect } from "react";
import { buildEmbedUrl } from "../utils/helper";
import { fetchSeasonEpisodes } from "../utils/api";
import { logDevError } from "../utils/logging";
import "../css/card.css"; 
import "../css/watch_party.css";
import { Episode, TmdbItem } from "../types/types";
import { useWatchParty } from "../hooks/useWatchParty";
import { supabase } from "../supabaseClient";
import { Icons, RTC_CONFIG, playBeep, resolveEpisodeNavigation } from "./player/playerDrawerUtils";

interface PlayerProps {
  item: TmdbItem;
  season: number;
  episode: number;
  onClose: () => void;
  isPipMode?: boolean;
  onTogglePip?: () => void;
  onNavigateEpisode?: (season: number, episode: number) => void;
  onProgressUpdate?: (seconds: number) => void;
  onEpisodeWatched?: (
    season: number,
    episode: number,
    nextTarget?: { season: number; episode: number } | null
  ) => void;
  startAt?: number;
}

export default function PlayerDrawer({ 
  item, season, episode, onClose, isPipMode, onTogglePip, onNavigateEpisode, onProgressUpdate, onEpisodeWatched, startAt 
}: PlayerProps) {
  const [isPartyMode, setIsPartyMode] = useState(false);
  const [roomInput, setRoomInput] = useState(""); 
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState(() => "Ospite-" + Math.floor(Math.random() * 100)); 
  
  // 1. NUOVO STATO: isLogged
  const [isLogged, setIsLogged] = useState(false);

  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isMicOn, setIsMicOn] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const talkingIntervalRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const { messages, userStates, viewers, countdown, sendMessage, sendSyncSignal, sendUserState, sendWebRTCSignal, setOnSignal } = useWatchParty(activeRoom, myUsername);

  const [currentProgress, setCurrentProgress] = useState(item.progressSeconds || 0);
  const [showResumePrompt, setShowResumePrompt] = useState(!!(item.progressSeconds && item.progressSeconds > 15));
  const [navigationMessage, setNavigationMessage] = useState("");
  const [showSavePositionModal, setShowSavePositionModal] = useState(false);
  const [saveMinutesInput, setSaveMinutesInput] = useState("0");
  const [saveSecondsInput, setSaveSecondsInput] = useState("0");
  const lastSavedRef = useRef(0);
  const completionSavedRef = useRef("");
  const durationRef = useRef(0);
  const currentProgressRef = useRef(item.progressSeconds || 0);
  const { previousTarget, nextTarget, nextLabel } = resolveEpisodeNavigation(
    item.seasonsDetails,
    season,
    episode
  );
  const [nextEpisodeState, setNextEpisodeState] = useState<"checking" | "available" | "unavailable" | "finished">(
    nextTarget ? "checking" : "finished"
  );
  const runtimeMinutes = Number.parseInt(item.runtime || "", 10);
  const fallbackDurationSeconds =
    (Number.isFinite(runtimeMinutes) && runtimeMinutes > 0 ? runtimeMinutes : 45) * 60;
  const nextEpisodeButtonLabel =
    nextEpisodeState === "finished"
      ? "Nessun prossimo episodio"
      : nextEpisodeState === "available"
        ? nextLabel
        : "Prossimo episodio non disponibile";
  const isNextEpisodeAvailable = nextEpisodeState === "available";

  const isEpisodeReleased = (ep?: Episode | null) => {
    if (!ep?.air_date) return false;
    const airDate = new Date(ep.air_date);
    if (Number.isNaN(airDate.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    airDate.setHours(0, 0, 0, 0);
    return airDate <= today;
  };

  const markEpisodeWatched = () => {
    if (!onEpisodeWatched) return;
    const completionKey = `${item.tmdbId}-${season}-${episode}`;
    if (completionSavedRef.current === completionKey) return;
    completionSavedRef.current = completionKey;
    onEpisodeWatched(season, episode, nextTarget);
    setNavigationMessage("Episodio completato");
  };

  const saveProgressNow = () => {
    const progress = currentProgressRef.current;
    const completionKey = `${item.tmdbId}-${season}-${episode}`;
    if (progress > 0 && completionSavedRef.current !== completionKey && onProgressUpdate) {
      lastSavedRef.current = progress;
      onProgressUpdate(progress);
    }
  };

  const handleManualSavePosition = () => {
    const knownSeconds = Math.max(0, Math.floor(currentProgressRef.current || 0));
    setSaveMinutesInput(String(Math.floor(knownSeconds / 60)));
    setSaveSecondsInput(String(knownSeconds % 60));
    setShowSavePositionModal(true);
  };

  const confirmManualSavePosition = () => {
    const minutes = Math.max(0, Math.floor(Number(saveMinutesInput) || 0));
    const seconds = Math.max(0, Math.min(59, Math.floor(Number(saveSecondsInput) || 0)));
    const nextProgress = (minutes * 60) + seconds;
    if (nextProgress <= 0) {
      setNavigationMessage("Inserisci una posizione valida");
      return;
    }

    updateProgressFromTime(nextProgress);
    if (onProgressUpdate) onProgressUpdate(nextProgress);
    lastSavedRef.current = nextProgress;
    setNavigationMessage(`Posizione salvata a ${minutes}:${String(seconds).padStart(2, "0")}`);
    setShowSavePositionModal(false);
  };

  const updateProgressFromTime = (time: number) => {
    if (time <= 0) return;
    currentProgressRef.current = time;
    setCurrentProgress(time);

    const completionKey = `${item.tmdbId}-${season}-${episode}`;
    const alreadyCompleted = completionSavedRef.current === completionKey;

    if (!alreadyCompleted && Math.abs(time - lastSavedRef.current) >= 15) {
      lastSavedRef.current = time;
      if (onProgressUpdate) onProgressUpdate(time);
    }

    const durationSeconds = durationRef.current || fallbackDurationSeconds;
    if (item.type === "tv" && time >= durationSeconds * 0.98) {
      markEpisodeWatched();
    }
  };

  const handleClose = () => {
    saveProgressNow();
    onClose();
  };

  // --- TRACCIAMENTO AUTOMATICO ---
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Filtro sicurezza (opzionale se conosciamo l'origin esatto)
      // if (!event.origin.includes('vixsrc.to')) return;

      try {
        const data = event.data;
        
        // Logica specifica per i messaggi del player
        // Molti player mandano { event: 'timeupdate', currentTime: 123 }
        // Altri mandano stringhe
        const payload = typeof data === "string" && data.trim().startsWith("{")
          ? JSON.parse(data)
          : data;

        let time = 0;
        if (typeof payload === 'object' && payload) {
          const eventName = String(payload.event || payload.type || payload.name || "").toLowerCase();
          if (eventName.includes("time") || eventName.includes("progress")) {
            time = Number(payload.currentTime ?? payload.current_time ?? payload.time ?? payload.seconds ?? payload.position ?? 0) || 0;
          }
          const duration = Number(payload.duration ?? payload.totalDuration ?? payload.total_duration ?? 0);
          if (Number.isFinite(duration) && duration > 0) durationRef.current = duration;
        } else if (typeof data === 'string' && data.startsWith('timeupdate:')) {
           time = parseFloat(data.split(':')[1]);
        }

        if (time > 0) updateProgressFromTime(time);
      } catch (e) { /* ignore */ }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fallbackDurationSeconds, item.tmdbId, item.type, onProgressUpdate, onEpisodeWatched, season, episode]);

  useEffect(() => {
    if (showResumePrompt) return;

    const timer = window.setInterval(() => {
      const completionKey = `${item.tmdbId}-${season}-${episode}`;
      if (completionSavedRef.current === completionKey) return;
      updateProgressFromTime(currentProgressRef.current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [fallbackDurationSeconds, item.tmdbId, item.type, onProgressUpdate, onEpisodeWatched, season, episode, showResumePrompt]);

  const handleResume = () => {
    setShowResumePrompt(false);
  };

  useEffect(() => {
    setNavigationMessage("");
    completionSavedRef.current = "";
    durationRef.current = 0;
    currentProgressRef.current = startAt || item.progressSeconds || 0;
    lastSavedRef.current = currentProgressRef.current;
  }, [season, episode, item.tmdbId, item.progressSeconds, startAt]);

  useEffect(() => {
    let isActive = true;

    if (item.type !== "tv") {
      setNextEpisodeState(nextTarget ? "available" : "finished");
      return;
    }

    if (!nextTarget) {
      setNextEpisodeState("finished");
      return;
    }

    setNextEpisodeState("checking");

    fetchSeasonEpisodes(item.tmdbId, nextTarget.season)
      .then((episodes) => {
        if (!isActive) return;
        const nextEpisode = episodes.find((entry) => entry.episode_number === nextTarget.episode) as Episode | undefined;
        if (!nextEpisode) {
          setNextEpisodeState("unavailable");
          return;
        }

        if (!isEpisodeReleased(nextEpisode)) {
          setNextEpisodeState("unavailable");
          return;
        }

        setNextEpisodeState("available");
      })
      .catch((error) => {
        logDevError("Errore controllo prossimo episodio", error);
        if (!isActive) return;
        setNextEpisodeState("unavailable");
      });

    return () => {
      isActive = false;
    };
  }, [item.tmdbId, item.type, nextLabel, nextTarget]);

  // 2. CONTROLLO LOGIN: Aggiorniamo isLogged
  useEffect(() => {
    const fetchUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session && session.user) {
            setIsLogged(true); // UTENTE LOGGATO
            const email = session.user.email || "";
            const namePart = email.split("@")[0];
            const masked = namePart.length > 3 ? namePart.substring(0, 3) + "***" : namePart + "***";
            setMyUsername(masked);
        } else {
            setIsLogged(false); // UTENTE NON LOGGATO
        }
    };
    fetchUser();
  }, []);

  // ... (TUTTI GLI ALTRI USE EFFECT E FUNZIONI RIMANGONO IDENTICI) ...
  useEffect(() => {
    setOnSignal(async (signal) => {
      const { sender, type, data } = signal;
      if (!peersRef.current[sender]) createPeerConnection(sender);
      const peer = peersRef.current[sender];
      try {
        if (type === 'offer') {
          await peer.setRemoteDescription(new RTCSessionDescription(data));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          sendWebRTCSignal(sender, 'answer', answer);
        } else if (type === 'answer') {
          await peer.setRemoteDescription(new RTCSessionDescription(data));
        } else if (type === 'ice-candidate') {
          if (data) await peer.addIceCandidate(new RTCIceCandidate(data));
        }
      } catch (err) { console.error("WebRTC Error:", err); }
    });
  }, [activeRoom]);

  useEffect(() => {
    if (!activeRoom || !localStream) return;
    viewers.forEach(user => {
      if (user !== myUsername && !peersRef.current[user]) {
        const peer = createPeerConnection(user);
        peer.createOffer().then(async (offer) => {
          await peer.setLocalDescription(offer);
          sendWebRTCSignal(user, 'offer', offer);
        });
      }
    });
  }, [viewers, activeRoom, localStream]);

  const createPeerConnection = (remoteUser: string) => {
    const peer = new RTCPeerConnection(RTC_CONFIG);
    peersRef.current[remoteUser] = peer;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => peer.addTrack(track, localStreamRef.current!));
    }
    peer.onicecandidate = (event) => {
      if (event.candidate) sendWebRTCSignal(remoteUser, 'ice-candidate', event.candidate);
    };
    peer.ontrack = (event) => {
      const audio = document.createElement('audio');
      audio.srcObject = event.streams[0];
      audio.autoplay = true;
      document.body.appendChild(audio);
      peer.onconnectionstatechange = () => {
         if (peer.connectionState === 'disconnected' || peer.connectionState === 'closed') audio.remove();
      };
    };
    return peer;
  };

  const toggleMic = async () => {
    if (isMicOn) {
        stopLocalStream();
        setIsMicOn(false);
        sendUserState(true, false);
    } else {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setLocalStream(stream);
            localStreamRef.current = stream;
            setIsMicOn(true);
            sendUserState(false, false);
            Object.values(peersRef.current).forEach(peer => {
                stream.getTracks().forEach(track => {
                    const senders = peer.getSenders();
                    const audioSender = senders.find(s => s.track?.kind === 'audio');
                    if (audioSender) audioSender.replaceTrack(track);
                    else peer.addTrack(track, stream);
                });
            });
            startVolumeAnalysis(stream);
        } catch (err) { alert("Impossibile accedere al microfono."); }
    }
  };

  const stopLocalStream = () => {
    if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
    }
    setLocalStream(null);
    if (talkingIntervalRef.current) clearInterval(talkingIntervalRef.current);
  };

  const startVolumeAnalysis = (stream: MediaStream) => {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      audioContextRef.current = audioCtx;
      talkingIntervalRef.current = setInterval(() => {
          analyser.getByteFrequencyData(dataArray);
          const vol = dataArray.reduce((a, b) => a + b) / dataArray.length;
          sendUserState(false, vol > 20);
      }, 200);
  };

  useEffect(() => {
    return () => { stopLocalStream(); Object.values(peersRef.current).forEach(p => p.close()); };
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (countdown) playBeep(countdown === 0 ? 300 : 600, countdown === 0 ? 'square' : 'sine'); }, [countdown]);

  const handleJoinOrCreate = () => {
    if (!roomInput.trim()) {
        const code = Math.random().toString(36).substring(2, 6).toUpperCase();
        setRoomInput(code);
        setActiveRoom(code);
    } else { setActiveRoom(roomInput.toUpperCase()); }
  };

  return (
    <div className={isPipMode ? "pip-backdrop" : "drawer-backdrop"} onClick={!isPipMode ? handleClose : undefined}>
      <div className={`drawer drawer-responsive ${isPartyMode ? 'party-active' : ''} ${isPipMode ? 'pip-drawer' : ''}`} onClick={e => e.stopPropagation()}>
        
        {/* PLAYER VIDEO */}
        <div className="video-container">
            {countdown !== null && <div className="party-overlay animate-pop">{countdown === 0 ? "▶ PLAY!" : countdown}</div>}
            
            <div className="video-header">
                {!isPipMode && <div><h3 className="video-title">{item.title}</h3></div>}
                <div style={{display:'flex', gap: 10, marginLeft: 'auto'}}>
                    
                    {/* 3. CONDIZIONE: Mostra bottone SOLO se isLogged è true */}
                    {isLogged && !isPipMode && (
                        <button 
                            className={`pill ${isPartyMode ? 'active' : 'ghost'}`} 
                            onClick={() => setIsPartyMode(!isPartyMode)} 
                            style={{display:'flex', alignItems:'center', gap:8, border: isPartyMode ? '1px solid #4ae8ff' : '1px solid #444'}}
                        >
                           <span style={{fontSize:'1.2rem'}}>🍿</span> Watch Party
                        </button>
                    )}
                    
                    {onTogglePip && (
                        <button className="pill ghost" onClick={onTogglePip} title={isPipMode ? "Espandi" : "Mini-Player (PiP)"}>
                           {isPipMode ? '🗖' : '🗗'}
                        </button>
                    )}

                    {!isPipMode && (
                        <button className="pill ghost save-position-btn" onClick={handleManualSavePosition}>
                          Salva posizione
                        </button>
                    )}

                    <button className="pill ghost" onClick={handleClose}><Icons.Close /></button>
                </div>
            </div>
            
            <iframe 
                key={`${season}-${episode}-${showResumePrompt}`}
                src={buildEmbedUrl(item.tmdbId, item.type, season, episode, showResumePrompt ? 0 : (startAt || item.progressSeconds))} 
                allowFullScreen 
                title="Player" 
                className="video-frame"
            />

            {showResumePrompt && (
                <div className="resume-overlay animate-fadeIn">
                    <div className="resume-box">
                        <div className="resume-icon">🕒</div>
                        <div className="resume-content">
                            <h4>Vuoi riprendere da dove avevi lasciato?</h4>
                            <p>Ultima posizione: <strong>{Math.floor(item.progressSeconds! / 60)}m {Math.floor(item.progressSeconds! % 60)}s</strong></p>
                            <div className="resume-actions">
                                <button className="pill solid primary" onClick={handleResume}>Riprendi</button>
                                <button className="pill ghost" onClick={() => setShowResumePrompt(false)}>Inizia da capo</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showSavePositionModal && (
                <div className="save-position-overlay animate-fadeIn" onClick={() => setShowSavePositionModal(false)}>
                    <div className="save-position-modal" onClick={event => event.stopPropagation()}>
                        <div className="save-position-header">
                            <span className="save-position-kicker">Sincronizza episodio</span>
                            <h4>Salva posizione</h4>
                        </div>
                        <div className="save-position-fields">
                            <label>
                                <span>Minuti</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={saveMinutesInput}
                                  onChange={event => setSaveMinutesInput(event.target.value)}
                                  autoFocus
                                />
                            </label>
                            <span className="save-position-separator">:</span>
                            <label>
                                <span>Secondi</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="59"
                                  value={saveSecondsInput}
                                  onChange={event => setSaveSecondsInput(event.target.value)}
                                />
                            </label>
                        </div>
                        <div className="save-position-actions">
                            <button className="pill ghost" onClick={() => setShowSavePositionModal(false)}>Annulla</button>
                            <button className="pill solid" onClick={confirmManualSavePosition}>Salva</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* 5. BINGE-WATCHING CONTROL BAR */}
            {item.type === 'tv' && !isPipMode && onNavigateEpisode && (
               <div className="binge-bar">
                   <button 
                      className="pill ghost"
                      style={{ fontSize: 0 }}
                      data-nav-label="Precedente"
                      disabled={!previousTarget}
                      onClick={() => {
                        if (previousTarget) onNavigateEpisode(previousTarget.season, previousTarget.episode);
                      }}
                   >◀ Precedente</button>
                   
                   <div className="binge-info">
                       Stagione <span style={{color: '#fff', fontWeight: 'bold'}}>{season}</span> • 
                       Episodio <span style={{color: '#fff', fontWeight: 'bold'}}>{episode}</span>
                       {navigationMessage && (
                        <div style={{ color: '#f5c26b', fontSize: '0.85rem', marginTop: 6 }}>
                          {navigationMessage}
                        </div>
                      )}
                   </div>
                   
                   <button 
                      className="pill solid"
                      style={{
                        background: isNextEpisodeAvailable ? '#e50914' : '#3a3d47',
                        color: '#fff',
                        border: 'none',
                        fontSize: 0,
                        opacity: isNextEpisodeAvailable ? 1 : 0.72,
                        cursor: isNextEpisodeAvailable ? 'pointer' : 'not-allowed'
                      }}
                      data-nav-label={nextEpisodeButtonLabel}
                      disabled={!nextTarget || !isNextEpisodeAvailable}
                      onClick={() => {
                        if (!nextTarget || !isNextEpisodeAvailable) {
                          setNavigationMessage(nextTarget ? "Prossimo episodio non disponibile" : "Hai finito la serie");
                          return;
                        }
                        if (nextTarget) {
                          markEpisodeWatched();
                          onNavigateEpisode(nextTarget.season, nextTarget.episode);
                          return;
                        }
                        setNavigationMessage("Hai finito la serie");
                      }}
                   >Prossimo ▶</button>
               </div>
            )}
        </div>

        {/* SIDEBAR PARTY (RENDERIZZA SOLO SE LOGGATO E PARTY ATTIVO) */}
        {isLogged && isPartyMode && (
            <div className="party-sidebar">
                {!activeRoom ? (
                    // LOGIN / CREA
                    <div className="party-login-container">
                        <div className="party-emoji-big">🍿</div>
                        <h3 style={{marginBottom: 10, color:'#fff'}}>Watch Party</h3>
                        <p style={{color:'#888', fontSize:'0.9rem', marginBottom:20}}>Guarda in sincronia con i tuoi amici.</p>
                        <input type="text" placeholder="CODICE STANZA" className="party-input-code" value={roomInput} onChange={e => setRoomInput(e.target.value.toUpperCase())} maxLength={6} />
                        <button className="cta" style={{width:'100%'}} onClick={handleJoinOrCreate}>{roomInput ? "ENTRA" : "CREA STANZA"}</button>
                    </div>
                ) : (
                    // STANZA ATTIVA
                    <>
                        <div className="party-header">
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 5}}>
                                <span style={{fontSize: '0.7rem', color: '#666', fontWeight:'bold', letterSpacing:1}}>CODICE STANZA</span>
                                <div className="party-live-indicator">
                                    <div style={{width:8, height:8, borderRadius:'50%', background:'#4cd137', boxShadow:'0 0 5px #4cd137'}}></div>
                                    <span style={{fontSize: '0.7rem', color: '#4cd137', fontWeight:'bold'}}>LIVE</span>
                                </div>
                            </div>
                            <div className="room-code-display">{activeRoom}</div>
                            <div className="party-users-list">
                                {Object.values(userStates).map((u, i) => (
                                    <div key={i} className={`party-user-badge ${u.isTalking ? 'talking' : ''}`}>
                                        <div style={{display:'flex', alignItems:'center', gap: 8}}>
                                            <span style={{fontSize:'0.8rem'}}>{u.user === myUsername ? '👑' : '👤'}</span>
                                            <span style={{fontSize:'0.85rem', color: u.isTalking ? '#fff' : '#aaa', fontWeight: u.isTalking ? 'bold' : 'normal'}}>{u.user}</span>
                                        </div>
                                        {u.isMuted ? <span style={{opacity:0.5, fontSize:'0.8rem'}}>🔴</span> : <span style={{fontSize:'0.8rem'}}>🔊</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="party-chat-area">
                            {messages.map((m, i) => (
                                <div key={i} className="chat-message">
                                    <span className={`chat-user ${m.user === myUsername ? 'me' : ''}`}>{m.user}</span>
                                    <span className="chat-text">{m.text}</span>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="party-controls">
                             <button onClick={sendSyncSignal} title="Lancia Countdown" className="btn-party-action btn-sync"><Icons.Sync /> SYNC</button>
                            <button onClick={toggleMic} className={`btn-party-action btn-mic ${isMicOn ? 'active' : ''}`}>{isMicOn ? <Icons.MicOn /> : <Icons.MicOff />}</button>
                        </div>
                        <div className="party-input-area">
                            <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (sendMessage(chatInput), setChatInput(''))} placeholder="Scrivi..." className="party-chat-input" />
                            <button onClick={() => { sendMessage(chatInput); setChatInput(''); }} className="btn-send"><Icons.Send /></button>
                        </div>
                        <div style={{textAlign:'center', padding:5, background:'#0a0a0a'}}>
                            <button onClick={() => { stopLocalStream(); setActiveRoom(null); setIsPartyMode(false); }} style={{background:'transparent', border:'none', color:'#555', fontSize:'0.7rem', cursor:'pointer', textTransform:'uppercase', letterSpacing:1}}>Esci</button>
                        </div>
                    </>
                )}
            </div>
        )}
      </div>
    </div>
  );
}
