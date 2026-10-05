export function FinanceHeader({
  title,
  description,
  onLogout,
}: {
  title: string;
  description: string;
  onLogout: () => void;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-stg-blue">
          Administración STG
        </p>
        <h1 className="mt-2 text-3xl font-black">{title}</h1>
        <p className="mt-2 max-w-3xl text-muted">{description}</p>
      </div>
      <button type="button" className="btn-secondary" onClick={onLogout}>
        Cerrar sesión
      </button>
    </header>
  );
}
