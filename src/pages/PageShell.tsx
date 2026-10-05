/** Shell placeholder used until the page is built in Phase 4/5. */
export default function PageShell({ title, phase }: { title: string; phase: number }) {
  return (
    <section className="p-8">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-muted">This page is scheduled for build phase {phase}.</p>
    </section>
  );
}
