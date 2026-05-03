import { Suspense } from "react";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Session } from "@supabase/supabase-js";

export function PageTransition({ children }: { children: React.ReactNode }) {
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

export function DeferredSection({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageTransition><div style={{ padding: "50px", textAlign: "center", color: "#888" }}>Caricamento...</div></PageTransition>}>
      {children}
    </Suspense>
  );
}

export function DeferredOverlay({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="drawer-backdrop"><div className="drawer drawer-responsive" style={{ minHeight: "240px", display: "grid", placeItems: "center", color: "#888" }}>Caricamento player...</div></div>}>
      {children}
    </Suspense>
  );
}

export function RequireAuth({ session, children }: { session: Session | null; children: React.ReactNode }) {
  return session ? <>{children}</> : <Navigate to="/auth" replace />;
}

export function RequireAdmin({
  session,
  isAdmin,
  adminReady,
  children,
}: {
  session: Session | null;
  isAdmin: boolean;
  adminReady: boolean;
  children: React.ReactNode;
}) {
  if (!session) return <Navigate to="/auth" replace />;
  if (!adminReady) {
    return (
      <PageTransition>
        <div style={{ padding: "50px", textAlign: "center", color: "#888" }}>Controllo permessi admin...</div>
      </PageTransition>
    );
  }
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
}
