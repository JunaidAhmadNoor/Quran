// "Mushaf" design tokens: warm paper, deep ink green, brass details. Shared by web (CSS
// variables, see tokens.css) and the future React Native app (these objects directly).

export const colorNames = [
  'bg',
  'surface',
  'surface-raised',
  'text',
  'text-muted',
  'primary',
  'primary-contrast',
  'accent',
  'border',
  'success',
  'danger',
  'focus',
] as const;

export type ColorName = (typeof colorNames)[number];
export type Palette = Record<ColorName, string>;

export const colors: { light: Palette; dark: Palette } = {
  light: {
    bg: '#F6F1E7',
    surface: '#FFFCF6',
    'surface-raised': '#EFE8DA',
    text: '#1F2A27',
    'text-muted': '#5E6A65',
    primary: '#1E4D45',
    'primary-contrast': '#FFFCF6',
    accent: '#A67C2E',
    border: '#E2D8C6',
    success: '#3C7A4E',
    danger: '#A3402F',
    focus: '#1E4D45',
  },
  dark: {
    bg: '#111714',
    surface: '#18201C',
    'surface-raised': '#202A25',
    text: '#ECE5D6',
    'text-muted': '#A3A99F',
    primary: '#7FBFAE',
    'primary-contrast': '#10201B',
    accent: '#D6B26A',
    border: '#2B3631',
    success: '#7CC08F',
    danger: '#E08A74',
    focus: '#D6B26A',
  },
};

export const radius = { control: '6px', card: '10px' } as const;

export const motion = {
  easing: [0.2, 0.8, 0.2, 1] as const,
  easingCss: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  durationMs: { fast: 150, base: 220, slow: 300 },
  staggerMs: 30,
} as const;

export const typography = {
  /** Never letter-space or synthesize bold on Quran text. */
  quran: { minSizePx: 28, lineHeight: 2.2 },
} as const;

/**
 * Pairs that must meet WCAG AA. `min` is 4.5 for body text, 3 for large text and UI marks.
 * Brass (accent) is for decoration and large text only. Light-mode success green on
 * surface-raised is 4.22:1, so success text is only placed on bg or surface.
 */
export const contrastRules: { fg: ColorName; bg: ColorName[]; min: number }[] = [
  { fg: 'text', bg: ['bg', 'surface', 'surface-raised'], min: 4.5 },
  { fg: 'text-muted', bg: ['bg', 'surface', 'surface-raised'], min: 4.5 },
  { fg: 'primary', bg: ['bg', 'surface', 'surface-raised'], min: 4.5 },
  { fg: 'danger', bg: ['bg', 'surface', 'surface-raised'], min: 4.5 },
  { fg: 'success', bg: ['bg', 'surface'], min: 4.5 },
  { fg: 'primary-contrast', bg: ['primary'], min: 4.5 },
  { fg: 'accent', bg: ['bg', 'surface', 'surface-raised'], min: 3 },
  { fg: 'focus', bg: ['bg', 'surface', 'surface-raised'], min: 3 },
];

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const block = (selector: string, palette: Palette, indent = '') =>
  `${indent}${selector} {\n${colorNames.map((n) => `${indent}  --${n}: ${palette[n]};`).join('\n')}\n${indent}  color-scheme: ${palette === colors.dark ? 'dark' : 'light'};\n${indent}}`;

/** CSS variables: light by default, dark from the OS unless overridden, and explicit overrides. */
export function tokensCss(): string {
  return [
    '/* Generated from packages/ui-tokens/src/index.ts by scripts/build-css.ts. Do not edit. */',
    block(':root', colors.light),
    `@media (prefers-color-scheme: dark) {\n${block(':root:not([data-theme="light"])', colors.dark, '  ')}\n}`,
    block(':root[data-theme="dark"]', colors.dark),
    `:root {\n  --radius-control: ${radius.control};\n  --radius-card: ${radius.card};\n  --ease: ${motion.easingCss};\n}`,
    '',
  ].join('\n\n');
}
