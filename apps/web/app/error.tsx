'use client';

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  return (
    <main className="crm-page">
      <div className="crm-backdrop" />
      <section className="error-shell" role="alert" aria-live="assertive">
        <p className="eyebrow">Workspace error</p>
        <h1 className="hero-title">Something broke in the CRM shell</h1>
        <p className="hero-copy">
          The current route failed to render. Retry the view, and if the problem repeats, inspect the latest local logs before continuing with sync or send actions.
        </p>
        <div className="state-card error">
          <h3>Failure details</h3>
          <p>{error.message || 'Unknown workspace error'}</p>
          {error.digest ? <p>Digest: {error.digest}</p> : null}
        </div>
        <div className="topbar-actions">
          <button className="accent-button" type="button" onClick={() => reset()}>
            Retry route
          </button>
        </div>
      </section>
    </main>
  );
}