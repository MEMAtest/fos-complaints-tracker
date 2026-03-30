import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

type FooterCtaProps = {
  workspaceHref: string;
};

export function FooterCta({ workspaceHref }: FooterCtaProps) {
  return (
    <section className="border-t border-slate-200 bg-[linear-gradient(180deg,#f6faff_0%,#eef5ff_100%)] py-16 md:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-8">
        <div className="overflow-hidden rounded-[2.2rem] border border-slate-200 bg-white/95 p-8 shadow-[0_32px_90px_rgba(15,23,42,0.10)] md:p-10">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Next step</p>
          <h2 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            Start with live complaint intelligence, then move into the workspace when you need handling depth.
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            The public layer is there to show the signal clearly. The secure workspace is where evidence, letters, approvals, actions, and board reporting come together.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/insights"
              className="inline-flex items-center gap-2 rounded-full bg-[#0f1f4f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0c1940]"
            >
              Explore live data
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={workspaceHref}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:border-sky-300 hover:text-sky-900"
            >
              Open workspace
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
