import type { HomepageExpectation } from '@/lib/marketing/types';

type ExpectationsSectionProps = {
  expectations: HomepageExpectation[];
};

export function ExpectationsSection({ expectations }: ExpectationsSectionProps) {
  return (
    <section id="expect" className="border-y border-slate-200/70 bg-[#0f1f4f] py-16 text-white md:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-8">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.24em] text-white/60">What users should expect</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            A clear route from public intelligence into secure complaint handling and reporting.
          </h2>
          <p className="mt-4 text-base leading-8 text-white/72">
            This section is deliberately plain-language. It tells people what they can actually do with the platform instead of hiding the workflow behind vague product claims.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {expectations.map((item) => (
            <article key={item.title} className="rounded-[1.7rem] border border-white/10 bg-white/7 p-5 backdrop-blur-sm">
              <h3 className="text-xl font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-white/72">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
