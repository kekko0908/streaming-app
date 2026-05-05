# Security Best Practices Report

## Executive Summary

Revisione eseguita su frontend React/Vite, client Supabase, Edge Functions e migration SQL. Non risultano vulnerabilita' note nelle dipendenze da `npm audit`, non sono stati trovati sink XSS diretti come `dangerouslySetInnerHTML`, `innerHTML` o `eval`, e le migration mostrano RLS attiva sulle tabelle principali.

Le anomalie principali sono concentrate su Edge Functions e integrazione player: alcune funzioni proxy accettano input troppo ampio, il tracking del player accetta messaggi da qualunque origin, CORS e header di sicurezza sono migliorabili, e gli errori server vengono restituiti troppo direttamente al client.

## High

### H-1. Qualunque utente autenticato puo' scrivere/sincronizzare `media_items` via service role

**Impatto:** un utente autenticato non-admin puo' usare la funzione con privilegi elevati per popolare o modificare il catalogo `media_items`, consumando anche quota TMDB e bypassando le policy RLS applicate al client.

**Evidenza:** in `supabase/functions/sync-media-item/index.ts:151` l'azione `sync` valida solo `tmdbId` e `type`, poi usa `adminClient` service role per fare `upsert` su `media_items` a `supabase/functions/sync-media-item/index.ts:158`. Il controllo admin esiste solo per `update_type`, a `supabase/functions/sync-media-item/index.ts:172`.

**Raccomandazione:** decidere se `sync` deve essere pubblica per ogni autenticato. Se non serve, spostare anche `sync` dietro `is_admin`. Se serve al normale uso app, limitarla con rate limit, allowlist di azioni, validazione piu' stretta e logging server-side.

## Medium

### M-1. `tmdb-proxy` espone un proxy TMDB troppo generico

**Evidenza:** `supabase/functions/tmdb-proxy/index.ts:407` gestisce `collection` usando `payload.endpoint` direttamente in `fetchMultiplePages`; `fetchJson` costruisce la path remota con quel valore a `supabase/functions/tmdb-proxy/index.ts:124`. Altre azioni (`details`, `recommendations`, `trailer`, `credits`, `season_episodes`) non validano sempre `tmdbId`, `type`, range e formato prima di comporre la path.

**Rischio:** non e' SSRF verso host arbitrari, perche' l'host e' fisso su TMDB, ma un utente autenticato puo' usare la funzione come proxy API piu' ampio del necessario e consumare quota o interrogare endpoint non previsti.

**Raccomandazione:** sostituire `endpoint` libero con parametri tipizzati (`collectionId`, `type`) e validare ogni action con schema esplicito: `type in ["movie","tv"]`, id interi positivi, page range limitato, sort/provider/genre allowlist.

### M-2. Tracking player via `postMessage` senza origin check

**Evidenza:** `src/components/PlayerDrawer.tsx:158` registra un listener `message`; il filtro origin e' commentato a `src/components/PlayerDrawer.tsx:159`, poi qualunque payload con evento `time` o `progress` aggiorna il progresso a `src/components/PlayerDrawer.tsx:172`. L'iframe esterno e' renderizzato senza `sandbox` a `src/components/PlayerDrawer.tsx:434`.

**Rischio:** un iframe o script nella pagina puo' inviare messaggi falsi e manipolare progresso, episodi completati e statistiche.

**Raccomandazione:** applicare allowlist su `event.origin` per il dominio del player, verificare `event.source === iframeRef.current?.contentWindow`, validare range di `time` e `duration`, e aggiungere `sandbox`/`allow` minimi compatibili con il player.

### M-3. CORS wildcard sulle Edge Functions

**Evidenza:** `supabase/functions/_shared/cors.ts:2` imposta `Access-Control-Allow-Origin: *` e `supabase/functions/_shared/cors.ts:3` permette header `authorization`.

**Rischio:** le funzioni autenticate e admin possono essere invocate da qualunque origin se un bearer token valido e' disponibile. Non sostituisce l'autorizzazione server-side, che in parte c'e', ma amplia la superficie cross-origin.

**Raccomandazione:** usare una allowlist di origin di produzione e sviluppo, riflettere solo origin consentite, e mantenere `OPTIONS` coerente con la stessa policy.

### M-4. Header di sicurezza incompleti

**Evidenza:** `vercel.json:6` configura `X-Content-Type-Options`, `vercel.json:10` configura `X-Frame-Options`, ma non ci sono `Content-Security-Policy`, `Referrer-Policy` e `Permissions-Policy`. `X-XSS-Protection` a `vercel.json:14` e' legacy e non sostituisce CSP.

**Rischio:** in caso di bug XSS o script terzi compromessi, manca una difesa browser significativa. L'app usa font esterni, immagini remote e iframe/video, quindi serve una CSP ragionata.

**Raccomandazione:** aggiungere una CSP inizialmente in report-only o testata in staging, poi enforcement. Includere `frame-src` per YouTube/player necessario, `img-src` per TMDB/avatar, `connect-src` per Supabase/TMDB function, e valutare `Referrer-Policy: strict-origin-when-cross-origin`.

### M-5. Errori interni restituiti al client dalle Edge Functions

**Evidenza:** `supabase/functions/sync-media-item/index.ts:163`, `supabase/functions/sync-media-item/index.ts:168`, `supabase/functions/admin-dashboard/index.ts:552` e `supabase/functions/tmdb-proxy/index.ts:487` restituiscono `error.message` al client.

**Rischio:** messaggi di database, auth o servizi terzi possono esporre dettagli interni utili per debugging offensivo.

**Raccomandazione:** loggare il dettaglio lato funzione e restituire al client codici/messaggi generici (`Request failed`, `Forbidden`, `Upstream failed`) con eventuale request id.

## Low

### L-1. Sessione Supabase persistita nel browser

**Evidenza:** `src/supabaseClient.ts:6` crea il client Supabase senza configurazione `auth`; il comportamento browser standard persiste la sessione in storage. In `src/hooks/useAppShellState.ts:93` il logout rimuove manualmente chiavi auth da `localStorage`.

**Rischio:** se in futuro compare una XSS, i token in storage diventano un obiettivo immediato.

**Raccomandazione:** mantenere alta la priorita' su CSP e assenza di HTML injection. Valutare sessioni meno persistenti o architettura backend-for-frontend solo se il threat model lo richiede.

### L-2. Operazioni client affidate a RLS senza filtro difensivo completo

**Evidenza:** `src/hooks/useStore.ts:312` elimina da `user_library` filtrando solo `tmdb_id`; RLS dovrebbe limitarla all'utente corrente, ma il filtro applicativo non include `user_id`.

**Rischio:** basso con RLS corretta, ma meno robusto se policy future cambiano o se la query viene riusata.

**Raccomandazione:** aggiungere anche `.eq("user_id", userId)` dopo `supabase.auth.getUser()` per coerenza con le altre write.

## Positive Findings

- `npm audit --audit-level=moderate` non segnala vulnerabilita'.
- Nessun uso trovato di `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML`, `document.write`, `eval` o `new Function`.
- `.env` e' in `.gitignore`; la chiave Supabase anon/publishable e' trattabile come pubblica, mentre service role e TMDB API key sono lato Edge Function.
- Le migration abilitano RLS sulle tabelle principali e revocano accesso anon a diverse funzioni RPC.
- L'admin dashboard verifica il ruolo server-side prima di usare il service role.

## Recommended Fix Order

1. Chiudere o limitare `sync-media-item` per utenti non-admin.
2. Validare schema e allowlist di tutte le action in `tmdb-proxy`.
3. Aggiungere origin/source check e sandbox al player iframe.
4. Restringere CORS delle Edge Functions.
5. Introdurre CSP e header mancanti in `vercel.json`.
6. Normalizzare gli errori restituiti dalle Edge Functions.
