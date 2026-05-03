export function AdminHero({
  onRefreshOverview,
  onRefreshUsers,
}: {
  onRefreshOverview: () => void;
  onRefreshUsers: () => void;
}) {
  return (
    <section className="admin-hero">
      <div className="admin-hero-copy">
        <span className="admin-eyebrow">System Control</span>
        <h1>Dashboard Admin</h1>
        <p>Vista completa su utenti, community e numeri reali della piattaforma.</p>
      </div>
      <div className="admin-hero-actions">
        <button className="pill ghost" onClick={onRefreshOverview}>Aggiorna KPI</button>
        <button className="pill solid" onClick={onRefreshUsers}>Aggiorna utenti</button>
      </div>
    </section>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="admin-section-title">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}
