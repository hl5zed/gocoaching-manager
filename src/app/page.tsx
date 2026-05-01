export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          GOThriveCoaching
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-normal sm:text-5xl">
          GoCoaching Manager
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
          Phase 0 scaffold is running. The Supabase schema and domain types are
          ready for the next application screens.
        </p>
      </section>
    </main>
  );
}
