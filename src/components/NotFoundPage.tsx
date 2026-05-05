import { Link } from "react-router-dom";
import "../css/notFound.css";

export default function NotFoundPage() {
  return (
    <main className="not-found-page" aria-labelledby="not-found-title">
      <div className="not-found-grid" aria-hidden="true" />
      <div className="not-found-scanline" aria-hidden="true" />

      <section className="not-found-panel">
        <div className="not-found-status">
          <span className="not-found-dot" />
          RISORSA NON CREATA
        </div>

        <h1 id="not-found-title" className="not-found-code" data-text="404">
          404
        </h1>

        <p className="not-found-copy">
          Questa risorsa non e' stata ancora creata o non esiste nel catalogo.
        </p>

        <div className="not-found-actions">
          <Link className="not-found-primary" to="/">
            Torna alla home
          </Link>
          <Link className="not-found-secondary" to="/archivio">
            Esplora archivio
          </Link>
        </div>
      </section>
    </main>
  );
}
