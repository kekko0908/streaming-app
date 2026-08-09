# Refresh uscite digitali

La funzione `refresh-upcoming-releases` accetta solo un amministratore autenticato oppure `x-cron-secret` uguale a `RELEASE_REFRESH_SECRET`.

Configurazione remota:

1. Impostare `TMDB_API_KEY`, `ALLOWED_ORIGINS` e `RELEASE_REFRESH_SECRET` con `supabase secrets set`.
2. Pubblicare la migration e le funzioni.
3. Creare in Supabase Cron un job `0 */6 * * *` che esegua una richiesta POST alla funzione con body `{"region":"IT"}` e header `x-cron-secret`.
4. Configurare Auth con JWT a 3600 secondi. Su piano Pro impostare time-box a 7 giorni e inattività a 24 ore.

Sul piano Free il client usa `sessionStorage` e applica i limiti 7 giorni/24 ore all'avvio, al focus e durante l'uso. Questo riduce la persistenza nel browser ma non revoca autonomamente un refresh token già sottratto; per quello usare “Esci da tutti i dispositivi”.
