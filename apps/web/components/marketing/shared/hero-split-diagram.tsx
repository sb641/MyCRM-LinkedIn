import Link from 'next/link';
import type { HeroSectionContent } from '@/lib/marketing/content';

interface HeroSplitDiagramProps {
  content: HeroSectionContent;
}

function DiagramColumn({
  label,
  items,
  tone = 'light'
}: {
  label: string;
  items: string[];
  tone?: 'light' | 'accent' | 'dark';
}) {
  const toneClassName =
    tone === 'accent'
      ? 'border-[#b9ddd8] bg-[#eef8f5] text-[#0b5d58]'
      : tone === 'dark'
        ? 'border-[#1d3854] bg-[#10263f] text-white'
        : 'border-[#d9e2e8] bg-white text-[#10263f]';

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#5e6b79]">{label}</p>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div
            key={item}
            className={`rounded-[18px] border px-4 py-4 text-sm font-medium shadow-[0_8px_24px_rgba(16,38,63,0.06),0_2px_6px_rgba(16,38,63,0.04)] ${toneClassName}`}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeroSplitDiagram({ content }: HeroSplitDiagramProps) {
  return (
    <section className="relative overflow-hidden bg-[#f7f8f5] px-5 py-[72px] md:px-6 lg:px-8 lg:py-[104px]">
      <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.12),transparent_45%)]" />
      <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_center,rgba(185,150,90,0.08),transparent_55%)] lg:block" />
      <div className="relative mx-auto grid max-w-[1200px] gap-12 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:items-center">
        <div className="max-w-[620px]">
          <p className="mb-5 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#0f766e]">
            {content.eyebrow}
          </p>
          <h1 className="font-sans text-[38px] font-bold leading-[1.02] tracking-[-0.03em] text-[#10263f] sm:text-[44px] lg:text-[58px]">
            {content.title}
          </h1>
          <p className="mt-6 max-w-[58ch] text-[18px] leading-[1.65] text-[#5e6b79]">
            {content.body}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href={content.primaryCta.href}
              className="inline-flex min-h-12 items-center justify-center rounded-[12px] bg-[#10263f] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0e2135]"
            >
              {content.primaryCta.label}
            </Link>
            <Link
              href={content.secondaryCta.href}
              className="inline-flex min-h-12 items-center justify-center rounded-[12px] border border-[#d9e2e8] bg-white px-5 text-sm font-semibold text-[#10263f] transition-colors hover:bg-[#f1f4f6]"
            >
              {content.secondaryCta.label}
            </Link>
          </div>
          <p className="mt-5 text-sm leading-6 text-[#5e6b79]">{content.supportingLine}</p>
        </div>

        <div className="relative rounded-[28px] border border-[#d9e2e8] bg-[linear-gradient(180deg,#ffffff_0%,#f1f4f6_100%)] p-6 shadow-[0_8px_24px_rgba(16,38,63,0.06),0_2px_6px_rgba(16,38,63,0.04)] sm:p-8">
          <div className="absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_top,rgba(15,118,110,0.08),transparent_38%),linear-gradient(135deg,transparent_0%,rgba(185,150,90,0.08)_100%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_72px_minmax(0,0.9fr)_72px_minmax(0,0.95fr)] lg:items-center">
            <DiagramColumn label="Signals" items={content.visual.inputs ?? []} />

            <div className="hidden lg:flex lg:flex-col lg:items-center lg:gap-4">
              <div className="h-px w-full bg-[linear-gradient(90deg,#d9e2e8_0%,#0f766e_100%)]" />
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#b9ddd8] bg-[#eef8f5] text-[#0f766e]">
                +
              </div>
              <div className="h-px w-full bg-[linear-gradient(90deg,#d9e2e8_0%,#0f766e_100%)]" />
            </div>

            <DiagramColumn label="Activation" items={content.visual.flow ?? []} tone="accent" />

            <div className="hidden lg:flex lg:flex-col lg:items-center lg:gap-4">
              <div className="h-px w-full bg-[linear-gradient(90deg,#0f766e_0%,#10263f_100%)]" />
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1d3854] bg-[#10263f] text-white">
                =
              </div>
              <div className="h-px w-full bg-[linear-gradient(90deg,#0f766e_0%,#10263f_100%)]" />
            </div>

            <DiagramColumn label="Outcomes" items={content.visual.outputs ?? []} tone="dark" />
          </div>
        </div>
      </div>
    </section>
  );
}