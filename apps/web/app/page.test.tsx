import { render, screen } from '@testing-library/react';
import HomePage from './page';

describe('HomePage', () => {
  it('renders the app shell placeholders and feature flags', () => {
    render(<HomePage />);

    expect(screen.getByText('LinkedIn CRM')).toBeInTheDocument();
    expect(screen.getByText(/Left navigation placeholder/i)).toBeInTheDocument();
    expect(screen.getByText(/Main content placeholder/i)).toBeInTheDocument();
    expect(screen.getByText(/Feature flags/i)).toBeInTheDocument();
  });
});
