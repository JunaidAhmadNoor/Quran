/** Levenshtein edit distance over Unicode code points (inputs are normalized Arabic letters). */
export function levenshtein(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  if (x.length === 0) return y.length;
  if (y.length === 0) return x.length;

  let previous = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const current = [i];
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[y.length] ?? 0;
}

/** 1 − distance / longer length, in [0, 1]. Two empty strings are identical. */
export function similarity(a: string, b: string): number {
  const longest = Math.max(Array.from(a).length, Array.from(b).length);
  return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest;
}
