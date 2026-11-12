import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { RevealPractice } from './reveal-practice';

const ayahs = [
  {
    number: 1,
    words: [
      { position: 1, text: 'قُلْ' },
      { position: 2, text: 'هُوَ' },
    ],
  },
  { number: 2, words: [{ position: 1, text: 'ٱللَّهُ' }] },
];

describe('RevealPractice (word reveal)', () => {
  it('starts with every word hidden behind a placeholder that keeps its width', () => {
    renderWithProviders(<RevealPractice ayahs={ayahs} />);
    expect(screen.getAllByRole('img', { name: 'Hidden word' })).toHaveLength(3);
    // The word is laid out (invisible) under its placeholder, so lines never jump on reveal.
    expect(screen.getByText('قُلْ')).toHaveClass('invisible');
  });

  it('reveals words in order, then all, then hides them again', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RevealPractice ayahs={ayahs} />);
    await user.click(screen.getByRole('button', { name: 'Reveal next word' }));
    expect(screen.getByText('قُلْ')).not.toHaveClass('invisible');
    expect(screen.getAllByRole('img', { name: 'Hidden word' })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Reveal all' }));
    expect(screen.queryAllByRole('img', { name: 'Hidden word' })).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Reveal next word' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Hide all' }));
    expect(screen.getAllByRole('img', { name: 'Hidden word' })).toHaveLength(3);
  });

  it('marks the end of each ayah with a labelled ornament', () => {
    renderWithProviders(<RevealPractice ayahs={ayahs} />);
    expect(screen.getByRole('img', { name: 'End of ayah 2' })).toBeInTheDocument();
  });
});
