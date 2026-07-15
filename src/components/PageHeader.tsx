type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  supportingText: string;
};

export function PageHeader({ eyebrow, title, supportingText }: PageHeaderProps) {
  const titleClassName = eyebrow
    ? "mt-2 text-3xl font-semibold tracking-tight text-slate-950"
    : "text-3xl font-semibold tracking-tight text-slate-950";

  return (
    <header className="rounded-2xl border border-slate-200/80 bg-white/85 px-5 py-5 shadow-[0_14px_45px_-35px_rgba(15,23,42,0.45)]">
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{eyebrow}</p>
      ) : null}
      <h1 className={titleClassName}>{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{supportingText}</p>
    </header>
  );
}
