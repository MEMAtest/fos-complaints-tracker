import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

type FooterCtaProps = {
  workspaceHref: string;
};

export function FooterCta({ workspaceHref }: FooterCtaProps) {
  return (
    <section className="relative overflow-hidden border-t border-slate-200 bg-[#08162f] py-16 text-white md:py-20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.24),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_40%)]" />
      <div className="relative mx-auto w-full max-w-7xl px-4 md:px-8">
        <div className="overflow-hidden rounded-[2.2rem] border border-white/10 bg-white/6 p-8 shadow-[0_32px_90px_rgba(0,0,0,0.24)] backdrop-blur-md md:p-10">
          <p className="text-xs uppercase tracking-[0.24em] text-white/55">Ready to build defensible complaint intelligence?</p>
          <h2 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight md:text-4xl">
            Start with live complaint intelligence, then move into the workspace when handling depth actually matters.
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-white/72">
            Public analysis, complaint handling workflow, and leadership reporting all sit on the same product layer. That is the difference between a live platform and another disconnected complaints stack.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/insights"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Start analysis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={workspaceHref}
              className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
            >
              Request workspace demo
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/55">
            <Link href="/insights" className="transition hover:text-white">Live Data</Link>
            <Link href="/comparison" className="transition hover:text-white">Platform</Link>
            <Link href={workspaceHref} className="transition hover:text-white">Workspace</Link>
            <Link href="/insights/years" className="transition hover:text-white">Public Insights</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
