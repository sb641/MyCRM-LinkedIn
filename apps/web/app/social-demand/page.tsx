import type { Metadata } from 'next';
import { HeroSplitDiagram } from '@/components/marketing/shared/hero-split-diagram';
import { socialDemandPageContent } from '@/lib/marketing/content';

export const metadata: Metadata = {
  title: socialDemandPageContent.seo.title,
  description: socialDemandPageContent.seo.description
};

export default function SocialDemandPage() {
  return <HeroSplitDiagram content={socialDemandPageContent.hero} />;
}