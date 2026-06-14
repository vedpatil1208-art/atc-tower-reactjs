import { render, screen } from '@testing-library/react';
import App from './App';

test('renders tower control console', () => {
  render(<App />);
  const titleElement = screen.getByText(/TOWER CONTROL CONSOLE/i);
  expect(titleElement).toBeInTheDocument();
});
