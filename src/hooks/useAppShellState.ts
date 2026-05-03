import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";
import { UPDATES_STORAGE_KEY, UPDATES_VERSION } from "../components/app/appUpdates";

export function useAppShellState(navigate: (path: string) => void) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminReady, setAdminReady] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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
        console.error("Errore lettura novita profilo:", error);
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
      if (error) console.error("Errore salvataggio novita profilo:", error);
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
    handleCloseUpdates,
  };
}
