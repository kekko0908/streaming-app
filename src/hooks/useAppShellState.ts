import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";
import { UPDATES_STORAGE_KEY, UPDATES_VERSION } from "../components/app/appUpdates";

const SESSION_MAX_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_IDLE_MS = 24 * 60 * 60 * 1000;
const SESSION_STARTED_KEY = "sfa_session_started_at";
const SESSION_ACTIVITY_KEY = "sfa_session_last_activity_at";

export function useAppShellState(navigate: (path: string) => void) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminReady, setAdminReady] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const now = Date.now();
        if (!sessionStorage.getItem(SESSION_STARTED_KEY)) sessionStorage.setItem(SESSION_STARTED_KEY, String(now));
        if (!sessionStorage.getItem(SESSION_ACTIVITY_KEY)) sessionStorage.setItem(SESSION_ACTIVITY_KEY, String(now));
      }
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (nextSession && event === "SIGNED_IN" && !sessionStorage.getItem(SESSION_STARTED_KEY)) {
        const now = String(Date.now());
        sessionStorage.setItem(SESSION_STARTED_KEY, now);
        sessionStorage.setItem(SESSION_ACTIVITY_KEY, now);
      }
      setSession(nextSession);
      if (!nextSession) {
        setIsAdmin(false);
        setAdminReady(false);
      }
      if (window.location.pathname === "/auth" && nextSession) navigate("/");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!session) return;
    let lastWrite = 0;
    const registerActivity = () => {
      const now = Date.now();
      if (now - lastWrite < 60_000) return;
      lastWrite = now;
      sessionStorage.setItem(SESSION_ACTIVITY_KEY, String(now));
    };
    const enforceLimits = async () => {
      const now = Date.now();
      const startedAt = Number(sessionStorage.getItem(SESSION_STARTED_KEY) || now);
      const activeAt = Number(sessionStorage.getItem(SESSION_ACTIVITY_KEY) || startedAt);
      if (now - startedAt <= SESSION_MAX_MS && now - activeAt <= SESSION_IDLE_MS) return;
      await supabase.auth.signOut({ scope: "local" });
      sessionStorage.removeItem(SESSION_STARTED_KEY);
      sessionStorage.removeItem(SESSION_ACTIVITY_KEY);
      setSession(null);
      navigate("/auth");
    };
    const activityEvents = ["pointerdown", "keydown", "touchstart"] as const;
    activityEvents.forEach((event) => window.addEventListener(event, registerActivity, { passive: true }));
    window.addEventListener("focus", enforceLimits);
    document.addEventListener("visibilitychange", enforceLimits);
    const interval = window.setInterval(enforceLimits, 60_000);
    void enforceLimits();
    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, registerActivity));
      window.removeEventListener("focus", enforceLimits);
      document.removeEventListener("visibilitychange", enforceLimits);
      window.clearInterval(interval);
    };
  }, [navigate, session]);

  useEffect(() => {
    let isActive = true;

    async function loadAdminState() {
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
    }

    loadAdminState();
    return () => {
      isActive = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    let isActive = true;

    async function loadUpdatesSeen() {
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
        console.error("Errore lettura novità profilo:", error);
        setShowUpdates(true);
        return;
      }

      if (data?.updates_seen_version !== UPDATES_VERSION) setShowUpdates(true);
    }

    loadUpdatesSeen();
    return () => {
      isActive = false;
    };
  }, [session?.user?.id]);

  const clearSupabaseAuthStorage = () => {
    try {
      [localStorage, sessionStorage].forEach((storage) => Object.keys(storage).forEach((key) => {
        if (key === "supabase.auth.token") storage.removeItem(key);
        if (key.startsWith("sb-") && key.endsWith("-auth-token")) storage.removeItem(key);
      }));
    } catch (error) {
      console.error("Errore pulizia storage auth:", error);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) console.error("Errore logout:", error);
    clearSupabaseAuthStorage();
    sessionStorage.removeItem(SESSION_STARTED_KEY);
    sessionStorage.removeItem(SESSION_ACTIVITY_KEY);
    setSession(null);
    setIsAdmin(false);
    setAdminReady(false);
    setShowUpdates(false);
    navigate("/auth");
  };

  const handleLogoutAll = async () => {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) console.error("Errore logout globale:", error);
    clearSupabaseAuthStorage();
    sessionStorage.removeItem(SESSION_STARTED_KEY);
    sessionStorage.removeItem(SESSION_ACTIVITY_KEY);
    setSession(null);
    setIsAdmin(false);
    setAdminReady(false);
    setShowUpdates(false);
    navigate("/auth");
  };

  const handleCloseUpdates = async () => {
    if (session?.user) {
      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: session.user.id,
            updates_seen_version: UPDATES_VERSION,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      if (error) console.error("Errore salvataggio novità profilo:", error);
    }

    localStorage.setItem(UPDATES_STORAGE_KEY, UPDATES_VERSION);
    setShowUpdates(false);
  };

  return {
    session,
    isAdmin,
    setIsAdmin,
    adminReady,
    showUpdates,
    setShowUpdates,
    handleLogout,
    handleLogoutAll,
    handleCloseUpdates,
  };
}
