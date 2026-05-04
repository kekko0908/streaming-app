export type HeroTab = "panoramica" | "episodi" | "dettagli";

export function HeroTabs({
  activeTab,
  hasEpisodes,
  hasCollection,
  onChange,
}: {
  activeTab: HeroTab;
  hasEpisodes: boolean;
  hasCollection: boolean;
  onChange: (tab: HeroTab) => void;
}) {
  return (
    <div className="hero-tabs-nav">
      <button className={`hero-tab ${activeTab === "panoramica" ? "active" : ""}`} onClick={() => onChange("panoramica")}>
        PANORAMICA
      </button>
      {hasEpisodes && (
        <button className={`hero-tab ${activeTab === "episodi" ? "active" : ""}`} onClick={() => onChange("episodi")}>
          EPISODI
        </button>
      )}
      {hasCollection && (
        <button className={`hero-tab ${activeTab === "dettagli" ? "active" : ""}`} onClick={() => onChange("dettagli")}>
          SAGA
        </button>
      )}
    </div>
  );
}
