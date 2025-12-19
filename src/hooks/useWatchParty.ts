/* src/hooks/useWatchParty.ts */
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';

export interface ChatMessage {
  user: string;
  text: string;
  timestamp: number;
}

export interface UserState {
  user: string;
  isMuted: boolean;
  isTalking: boolean;
}

// Tipi per WebRTC Signaling
type SignalPayload = {
  type: 'offer' | 'answer' | 'ice-candidate';
  target: string;
  sender: string;
  data: any;
};

export function useWatchParty(roomId: string | null, username: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userStates, setUserStates] = useState<Record<string, UserState>>({});
  const [viewers, setViewers] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  const onSignalRef = useRef<((signal: SignalPayload) => void) | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!roomId) return;

    setMessages([]);
    setUserStates({});
    setViewers([]);

    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        // CORREZIONE FONDAMENTALE: self: true permette a te di ricevere il tuo stesso segnale di SYNC
        broadcast: { self: true }, 
        presence: { key: username },
      },
    });

    channel
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        setMessages((prev) => [...prev, payload as ChatMessage]);
      })
      .on('broadcast', { event: 'sync_start' }, () => {
        // Ora questa funzione partirà ANCHE per chi ha cliccato il bottone
        startLocalCountdown();
      })
      .on('broadcast', { event: 'user_state' }, ({ payload }) => {
        const update = payload as UserState;
        setUserStates(prev => ({ ...prev, [update.user]: update }));
      })
      .on('broadcast', { event: 'rtc-signal' }, ({ payload }) => {
        const signal = payload as SignalPayload;
        // Filtriamo i messaggi WebRTC: li accetto solo se sono destinati a me
        if (signal.target === username && onSignalRef.current) {
          onSignalRef.current(signal);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat().map((u: any) => u.user);
        setViewers(users);
        
        setUserStates(prev => {
            const newState = { ...prev };
            users.forEach((u: string) => {
                if (!newState[u]) newState[u] = { user: u, isMuted: true, isTalking: false };
            });
            return newState;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user: username, online_at: new Date().toISOString() });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, username]);

  const startLocalCountdown = () => {
    // Reset preventivo per assicurare che riparta se cliccato due volte
    setCountdown(null);
    setTimeout(() => {
        let count = 3;
        setCountdown(count);
        const interval = setInterval(() => {
          count--;
          if (count === 0) {
              setCountdown(0);
          } else if (count < 0) {
            setCountdown(null);
            clearInterval(interval);
          } else {
            setCountdown(count);
          }
        }, 1000);
    }, 50);
  };

  const sendMessage = (text: string) => {
    channelRef.current?.send({ type: 'broadcast', event: 'chat', payload: { user: username, text, timestamp: Date.now() } });
  };

  const sendSyncSignal = () => {
    channelRef.current?.send({ type: 'broadcast', event: 'sync_start', payload: {} });
  };

  const sendUserState = (isMuted: boolean, isTalking: boolean) => {
    channelRef.current?.send({ type: 'broadcast', event: 'user_state', payload: { user: username, isMuted, isTalking } });
  };

  const sendWebRTCSignal = (targetUser: string, type: 'offer' | 'answer' | 'ice-candidate', data: any) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'rtc-signal',
      payload: { type, target: targetUser, sender: username, data }
    });
  };

  const setOnSignal = (cb: (signal: SignalPayload) => void) => {
    onSignalRef.current = cb;
  };

  return { messages, userStates, viewers, countdown, sendMessage, sendSyncSignal, sendUserState, sendWebRTCSignal, setOnSignal };
}