import type { Route } from 'next';

export const marketingRoutes = {
  home: '/',
  socialDemand: '/social-demand',
  creatorSourcing: '/creator-sourcing',
  mapsAiVisibility: '/maps-ai-visibility',
  blog: '/blog'
} as const;

export interface MarketingActionLink {
  label: string;
  href: Route | `#${string}`;
}

export interface HeroVisualContent {
  inputs?: string[];
  flow?: string[];
  outputs?: string[];
}

export interface HeroSectionContent {
  eyebrow: string;
  title: string;
  body: string;
  primaryCta: MarketingActionLink;
  secondaryCta: MarketingActionLink;
  supportingLine: string;
  visual: HeroVisualContent;
}

export interface SocialDemandPageContent {
  seo: {
    title: string;
    description: string;
  };
  hero: HeroSectionContent;
}

export const socialDemandPageContent: SocialDemandPageContent = {
  seo: {
    title: 'Social Demand Activation for Hotels | InsightArc',
    description:
      'Use guest, CRM, and website signals to build stronger custom audiences for TikTok and support direct hotel demand.'
  },
  hero: {
    eyebrow: 'Social Demand Activation',
    title: 'Turn hotel data into better TikTok audiences',
    body: 'Use guest, CRM, and website signals to build stronger custom audiences for TikTok and support more qualified traffic and direct demand.',
    primaryCta: {
      label: 'Request a social demand audit',
      href: '#request-a-social-demand-audit'
    },
    secondaryCta: {
      label: 'Book a demo',
      href: '#book-a-demo'
    },
    supportingLine:
      'Built for hotel teams that want better paid social inputs without broad targeting.',
    visual: {
      inputs: ['Guest data', 'Website data', 'CRM data'],
      flow: ['Better custom audiences', 'TikTok'],
      outputs: ['Qualified traffic', 'Direct demand']
    }
  }
};