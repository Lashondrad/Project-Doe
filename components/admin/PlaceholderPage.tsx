export function PlaceholderPage({ title, note }: { title: string; note: string }) {
  return (
    <div>
      <h1 className="mb-4 font-display text-2xl italic text-charcoal">{title}</h1>
      <div className="card p-8 text-center text-charcoal/60">
        <p>{note}</p>
      </div>
    </div>
  );
}
