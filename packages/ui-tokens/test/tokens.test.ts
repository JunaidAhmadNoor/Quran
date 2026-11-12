import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { colorNames, colors, contrastRatio, contrastRules, tokensCss } from '../src';

describe('Mushaf palette', () => {
  it.each(['light', 'dark'] as const)('meets WCAG AA for every allowed pair (%s)', (mode) => {
    const palette = colors[mode];
    for (const rule of contrastRules) {
      for (const bg of rule.bg) {
        const ratio = contrastRatio(palette[rule.fg], palette[bg]);
        expect(ratio, `${rule.fg} on ${bg} (${mode}) = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(
          rule.min,
        );
      }
    }
  });

  it('documents the one pair that fails: light success on surface-raised', () => {
    expect(contrastRatio(colors.light.success, colors.light['surface-raised'])).toBeLessThan(4.5);
    expect(contrastRules.find((r) => r.fg === 'success')?.bg).not.toContain('surface-raised');
  });

  it('uses no pure black or pure white', () => {
    for (const palette of [colors.light, colors.dark]) {
      for (const name of colorNames)
        expect(palette[name].toUpperCase()).not.toMatch(/^#(000000|FFFFFF)$/);
    }
  });

  it('keeps tokens.css generated from the source', () => {
    expect(readFileSync(new URL('../tokens.css', import.meta.url), 'utf8')).toBe(tokensCss());
  });

  it('computes known contrast ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1);
  });
});
