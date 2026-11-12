import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { RecitationList } from './recitation-list';
import type { RecitationItem } from './types';

const item = (id: string, title: string): RecitationItem => ({
  id,
  surah: 112,
  ayahFrom: 1,
  ayahTo: 4,
  title,
  riwayah: 'hafs',
  style: 'murattal',
  durationSec: 30,
  status: 'approved',
  playCount: 0,
  likeCount: 0,
  createdAt: '2026-11-12T08:00:00.000Z',
  reciter: { id: 'r'.repeat(24), name: 'Yusuf', image: null, country: null, verifiedReciter: true },
  stream: { url: `https://storage.test/${id}.mp3`, expiresAt: null, contentType: 'audio/mpeg' },
  viewer: null,
});

describe('RecitationList', () => {
  it('keeps two lists with the same source apart (regression: playlist page showed liked items)', () => {
    renderWithProviders(
      <>
        <RecitationList
          scope="library-likes"
          source={{ kind: 'likes' }}
          label="Liked"
          initial={{ items: [item('a'.repeat(24), 'Liked one')], nextCursor: null }}
        />
        <RecitationList
          scope="playlist-1"
          source={{ kind: 'likes' }}
          label="Playlist"
          initial={{ items: [item('b'.repeat(24), 'Playlist one')], nextCursor: null }}
        />
      </>,
    );
    expect(
      within(screen.getByRole('list', { name: 'Playlist' })).getByText('Playlist one'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Liked' })).queryByText('Playlist one'),
    ).not.toBeInTheDocument();
  });

  it('shows a play button, reciter link with verified badge, and a load-more button only when there is more', () => {
    renderWithProviders(
      <RecitationList
        scope="t"
        source={{ kind: 'recitations', sort: 'newest' }}
        label="List"
        initial={{ items: [item('c'.repeat(24), 'Al-Ikhlas')], nextCursor: 'next' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Play: Al-Ikhlas' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Yusuf' })).toHaveAttribute(
      'href',
      `/reciters/${'r'.repeat(24)}`,
    );
    expect(screen.getByTitle('Verified reciter')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();
  });
});
