import { getFeatureFlags } from '@mycrm/core';

export default function HomePage() {
  const flags = safeGetFeatureFlags();

  return (
    <main style={{ padding: '24px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr 320px',
          gap: '16px',
          minHeight: 'calc(100vh - 48px)'
        }}
      >
        <section style={panelStyle}>
          <p style={eyebrowStyle}>Contacts</p>
          <h1 style={titleStyle}>LinkedIn CRM</h1>
          <p style={copyStyle}>Left navigation placeholder for contact list, filters, and sync actions.</p>
        </section>
        <section style={panelStyle}>
          <p style={eyebrowStyle}>Conversation</p>
          <h2 style={sectionTitleStyle}>Main content placeholder</h2>
          <p style={copyStyle}>Conversation timeline, CRM state, and draft workflow will land here in later phases.</p>
        </section>
        <section style={panelStyle}>
          <p style={eyebrowStyle}>Settings</p>
          <h2 style={sectionTitleStyle}>Feature flags</h2>
          <ul style={listStyle}>
            <li>AI: {String(flags.ENABLE_AI)}</li>
            <li>Automation: {String(flags.ENABLE_AUTOMATION)}</li>
            <li>Real browser sync: {String(flags.ENABLE_REAL_BROWSER_SYNC)}</li>
            <li>Real send: {String(flags.ENABLE_REAL_SEND)}</li>
          </ul>
        </section>
      </div>
    </main>
  );
}

function safeGetFeatureFlags() {
  try {
    return getFeatureFlags();
  } catch {
    return {
      ENABLE_AI: false,
      ENABLE_AUTOMATION: false,
      ENABLE_REAL_BROWSER_SYNC: false,
      ENABLE_REAL_SEND: false
    };
  }
}

const panelStyle = {
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: '24px',
  padding: '24px',
  boxShadow: '0 18px 40px rgba(31, 26, 23, 0.08)'
} as const;

const eyebrowStyle = {
  margin: 0,
  color: 'var(--muted)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  fontSize: '0.75rem'
};

const titleStyle = {
  margin: '12px 0 8px',
  fontSize: '2.4rem'
} as const;

const sectionTitleStyle = {
  margin: '12px 0 8px',
  fontSize: '1.5rem'
} as const;

const copyStyle = {
  margin: 0,
  color: 'var(--muted)',
  lineHeight: 1.6
} as const;

const listStyle = {
  margin: '16px 0 0',
  paddingLeft: '18px',
  color: 'var(--muted)',
  lineHeight: 1.8
} as const;
