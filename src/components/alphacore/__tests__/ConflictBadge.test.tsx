/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

const pushMock = vi.fn();
const pathnameMock = vi.fn<() => string>();

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/alphacore/offline/idb', () => ({
  getOutboxByStatus: vi.fn(),
}));

import { toast } from 'sonner';
import { getOutboxByStatus } from '@/lib/alphacore/offline/idb';
import ConflictBadge from '../ConflictBadge.client';

describe('ConflictBadge', () => {
  beforeEach(() => {
    vi.mocked(pathnameMock).mockReset();
    vi.mocked(pushMock).mockReset();
    vi.mocked(getOutboxByStatus).mockReset();
    vi.mocked(toast.warning).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when there are no conflicts', async () => {
    pathnameMock.mockReturnValue('/dashboard');
    vi.mocked(getOutboxByStatus).mockResolvedValue([]);

    const { container } = render(<ConflictBadge />);

    // Allow the hook's first poll to fire.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(container.firstChild).toBeNull();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('renders the pill with the correct count when conflicts are present', async () => {
    pathnameMock.mockReturnValue('/dashboard');
    vi.mocked(getOutboxByStatus).mockResolvedValue([
      { id: '1' } as never,
      { id: '2' } as never,
    ]);

    render(<ConflictBadge />);

    const button = await screen.findByRole(
      'button',
      { name: /resolver 2 conflictos pendientes/i },
      { timeout: 2000 }
    );
    expect(button).toHaveTextContent('2 conflictos');
  });

  it('uses singular wording when the count is exactly 1', async () => {
    pathnameMock.mockReturnValue('/dashboard');
    vi.mocked(getOutboxByStatus).mockResolvedValue([{ id: '1' } as never]);

    render(<ConflictBadge />);

    const button = await screen.findByRole(
      'button',
      { name: /resolver 1 conflicto pendiente/i },
      { timeout: 2000 }
    );
    expect(button).toHaveTextContent('1 conflicto');
  });

  it('toasts once when count transitions from 0 to N', async () => {
    pathnameMock.mockReturnValue('/dashboard');
    vi.mocked(getOutboxByStatus).mockResolvedValue([
      { id: '1' } as never,
      { id: '2' } as never,
      { id: '3' } as never,
    ]);

    render(<ConflictBadge />);

    await waitFor(
      () => expect(toast.warning).toHaveBeenCalledTimes(1),
      { timeout: 2000 }
    );
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining('3 conflictos'),
      expect.objectContaining({ description: expect.any(String) })
    );
  });

  it('does NOT render on the conflicts page itself', async () => {
    pathnameMock.mockReturnValue('/dashboard/conflicts');
    vi.mocked(getOutboxByStatus).mockResolvedValue([{ id: '1' } as never]);

    const { container } = render(<ConflictBadge />);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(container.firstChild).toBeNull();
    // And it should not even poll IDB on the disabled path.
    expect(getOutboxByStatus).not.toHaveBeenCalled();
  });

  it('does NOT render on auth pages', async () => {
    pathnameMock.mockReturnValue('/auth/login');
    vi.mocked(getOutboxByStatus).mockResolvedValue([{ id: '1' } as never]);

    const { container } = render(<ConflictBadge />);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(container.firstChild).toBeNull();
    expect(getOutboxByStatus).not.toHaveBeenCalled();
  });
});
