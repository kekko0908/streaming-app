import "../css/updates.css";

export type UpdateItem = {
  title: string;
  text: string;
};

interface UpdatesModalProps {
  items: UpdateItem[];
  version: string;
  onClose: () => void;
}

export default function UpdatesModal({ items, version, onClose }: UpdatesModalProps) {
  return (
    <div className="updates-backdrop" onClick={onClose}>
      <div className="updates-modal" onClick={(e) => e.stopPropagation()}>
        <div className="updates-header">
          <span className="updates-kicker">Novità</span>
          <h2>Nuove funzioni e fix</h2>
          <p>Abbiamo migliorato l'esperienza per farti scegliere cosa guardare piu in fretta.</p>
          <div className="updates-version">Versione attuale: {version}</div>
        </div>

        <div className="updates-list">
          {items.map((item, index) => (
            <div key={`${item.title}-${index}`} className="updates-item">
              <div className="updates-dot" aria-hidden="true" />
              <div>
                <div className="updates-title">{item.title}</div>
                <div className="updates-text">{item.text}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="updates-actions">
          <button className="pill solid" onClick={onClose}>Perfetto</button>
          <span className="updates-footnote">Lo rivedrai solo quando pubblicheremo nuove novità.</span>
        </div>
      </div>
    </div>
  );
}
