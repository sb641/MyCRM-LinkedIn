import { fireEvent, render, screen } from '@testing-library/react';
import GlobalErrorPage from './error';

describe('GlobalErrorPage', () => {
  it('renders the fallback and retries the route on demand', () => {
    const reset = vi.fn();

    render(
      <GlobalErrorPage
        error={Object.assign(new Error('Route exploded'), { digest: 'digest-123' })}
        reset={reset}
      />
    );

    expect(screen.getByText('Something broke in the CRM shell')).toBeInTheDocument();
    expect(screen.getByText('Route exploded')).toBeInTheDocument();
    expect(screen.getByText('Digest: digest-123')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry route' }));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});