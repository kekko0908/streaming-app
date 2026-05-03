import type { UpdateItem } from "../UpdatesModal";

export const UPDATES_STORAGE_KEY = "sfa_updates_seen";
export const UPDATES_VERSION = "1.5.0";

export const updatesItems: UpdateItem[] = [
  {
    title: "Dashboard Admin",
    text: "Gli amministratori possono controllare utenti, KPI, suggerimenti recenti e ruoli da una nuova area dedicata.",
  },
  {
    title: "Statistiche piu affidabili",
    text: "Il tracciamento evita doppi conteggi dello stesso episodio e mantiene piu puliti eventi e progressi.",
  },
  {
    title: "Catalogo piu preciso",
    text: "La sincronizzazione dei titoli salva meglio tipo, durata, poster, generi ed episodi totali per ranking e profili.",
  },
];
