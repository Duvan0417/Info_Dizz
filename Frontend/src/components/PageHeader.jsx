/** Encabezado consistente para las páginas internas: título, subtítulo
 * opcional y una zona de acciones (links/botones) alineada a la derecha en
 * pantallas anchas. Reemplaza los <header> ad-hoc que cada página repetía. */
export default function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="animate-fade-in-up mb-7 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
      <div>
        <h1 className="m-0 text-2xl font-semibold tracking-tight text-text-h sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-text">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
