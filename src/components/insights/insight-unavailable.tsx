import Link from 'next/link';

export function InsightUnavailable({ label }: { label: string }) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-16 md:px-8 md:py-24">
      <section className="rounded-[2rem] border border-amber-200 bg-[linear-gradient(180deg,#fff8ed_0%,#ffffff_100%)] p-7 shadow-sm md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">Evidence temporarily unavailable</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{label}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          The public evidence service could not complete this analysis safely. No figures are being guessed or replaced with stale prose. Please retry shortly or continue from the verified archive.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/insights" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
            Return to Insights
          </Link>
          <Link href="/" className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
            Platform overview
          </Link>
        </div>
      </section>
    </main>
  );
}
