import { MediaType, SavedItem, STATUS_SECTIONS, WatchStatus } from "../../types/types";
import Card, { SkeletonCard } from "../Card";

interface MyListRouteContentProps {
  filteredMyList: SavedItem[];
  listLoading: boolean;
  listSearch: string;
  listTypeFilter: "all" | MediaType;
  listStatusFilter: "all" | WatchStatus;
  listSort: "added" | "rating" | "year";
  isAdmin: boolean;
  getProgress: (tmdbId: string) => { season: number; episode: number; watchedEpisodes?: number; totalEpisodes?: number; progressSeconds?: number; progressMinutes?: number };
  onListSearchChange: (value: string) => void;
  onListTypeFilterChange: (value: "all" | MediaType) => void;
  onListStatusFilterChange: (value: "all" | WatchStatus) => void;
  onListSortChange: (value: "added" | "rating" | "year") => void;
  onSelectItem: (item: SavedItem) => void;
  onRemoveFromList: (tmdbId: string) => void;
  onTypeChange: (tmdbId: string, nextType: MediaType) => void;
}

export function MyListRouteContent({
  filteredMyList,
  listLoading,
  listSearch,
  listTypeFilter,
  listStatusFilter,
  listSort,
  isAdmin,
  getProgress,
  onListSearchChange,
  onListTypeFilterChange,
  onListStatusFilterChange,
  onListSortChange,
  onSelectItem,
  onRemoveFromList,
  onTypeChange,
}: MyListRouteContentProps) {
  return (
    <div style={{ paddingTop: "20px" }}>
      <div className="list-page-header">
        <h1>La mia lista</h1>
        <p style={{ opacity: 0.6 }}>Gestisci i tuoi titoli salvati.</p>
      </div>

      <div className="filter-bar" style={{ marginBottom: "40px" }}>
        <div className="filter-group">
          <span className="filter-label">Cerca</span>
          <input
            className="filter-select"
            placeholder="Titolo..."
            value={listSearch}
            onChange={(event) => onListSearchChange(event.target.value)}
            style={{ width: "200px", cursor: "text", backgroundImage: "none" }}
          />
        </div>

        <div className="filter-group">
          <span className="filter-label">Tipologia</span>
          <select className="filter-select" value={listTypeFilter} onChange={(event) => onListTypeFilterChange(event.target.value as "all" | MediaType)}>
            <option value="all">Tutti</option>
            <option value="movie">Film</option>
            <option value="tv">Serie TV</option>
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-label">Stato</span>
          <select className="filter-select" value={listStatusFilter} onChange={(event) => onListStatusFilterChange(event.target.value as "all" | WatchStatus)}>
            <option value="all">Tutti gli stati</option>
            {STATUS_SECTIONS.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-label">Ordina per</span>
          <select className="filter-select" value={listSort} onChange={(event) => onListSortChange(event.target.value as "added" | "rating" | "year")}>
            <option value="added">Data aggiunta</option>
            <option value="rating">Voto Personale</option>
            <option value="year">Anno Uscita</option>
          </select>
        </div>
      </div>

      {listLoading && (
        <div className="grid">
          {Array.from({ length: 12 }).map((_, index) => <SkeletonCard key={index} />)}
        </div>
      )}

      {STATUS_SECTIONS.map((section) => {
        if (listStatusFilter !== "all" && listStatusFilter !== section.id) return null;

        const sectionItems = filteredMyList.filter((item) => item.status === section.id);
        if (sectionItems.length === 0) return null;

        const movies = sectionItems.filter((item) => item.type === "movie");
        const tvShows = sectionItems.filter((item) => item.type === "tv");

        return (
          <div key={section.id} className="list-section" style={{ marginBottom: "60px" }}>
            <div className="list-section-header">
              <h2 className="list-section-title">
                {section.label}
                <span style={{ fontSize: "0.6em", opacity: 0.5, marginLeft: "10px", verticalAlign: "middle" }}>({sectionItems.length})</span>
              </h2>
            </div>
            <div className="grid">
              {[...movies, ...tvShows].map((item) => (
                <Card
                  key={item.tmdbId}
                  item={item}
                  onClick={() => onSelectItem(item)}
                  onRemove={() => onRemoveFromList(item.tmdbId)}
                  showRating={true}
                  progress={getProgress(item.tmdbId)}
                  onTypeChange={isAdmin ? (nextType) => onTypeChange(item.tmdbId, nextType) : undefined}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
