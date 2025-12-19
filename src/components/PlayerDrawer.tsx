/* src/components/PlayerDrawer.tsx */
import { useState, useRef, useEffect } from "react";
import { buildEmbedUrl } from "../utils/helper";
import "../css/card.css"; 
import "../css/watch_party.css";
import { TmdbItem } from "../types/types";
import { useWatchParty } from "../hooks/useWatchParty";
import { supabase } from "../supabaseClient";

// ... (MANTENIAMO ICONS, RTC_CONFIG, E PLAYBEEP INVARIATI COME PRIMA) ...
const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const Icons = {
    MicOn: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
    MicOff: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
    Sync: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>,
    Send: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
    Close: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
};
const playBeep = (freq = 440, type: OscillatorType = 'sine') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.05; 
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.15); 
    setTimeout(() => ctx.close(), 200);
  } catch (e) { console.error("Audio error", e); }
};

interface PlayerProps {
  item: TmdbItem;
  season: number;
  episode: number;
  onClose: () => void;
}

export default function PlayerDrawer({ item, season, episode, onClose }: PlayerProps) {
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
    <div className="drawer-backdrop" onClick={onClose}>
      <div className={`drawer drawer-responsive ${isPartyMode ? 'party-active' : ''}`} onClick={e => e.stopPropagation()}>
        
        {/* PLAYER VIDEO */}
        <div className="video-container">
            {countdown !== null && <div className="party-overlay animate-pop">{countdown === 0 ? "▶ PLAY!" : countdown}</div>}
            
            <div className="video-header">
                <div><h3 className="video-title">{item.title}</h3></div>
                <div style={{display:'flex', gap: 10}}>
                    
                    {/* 3. CONDIZIONE: Mostra bottone SOLO se isLogged è true */}
                    {isLogged && (
                        <button 
                            className={`pill ${isPartyMode ? 'active' : 'ghost'}`} 
                            onClick={() => setIsPartyMode(!isPartyMode)} 
                            style={{display:'flex', alignItems:'center', gap:8, border: isPartyMode ? '1px solid #4ae8ff' : '1px solid #444'}}
                        >
                           <span style={{fontSize:'1.2rem'}}>🍿</span> Watch Party
                        </button>
                    )}
                    
                    <button className="pill ghost" onClick={onClose}><Icons.Close /></button>
                </div>
            </div>
            
            <iframe 
                src={buildEmbedUrl(item.tmdbId, item.type, season, episode)} 
                allowFullScreen 
                title="Player" 
                className="video-frame"
            />
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