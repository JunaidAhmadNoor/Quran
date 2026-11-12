export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** UTC calendar day as YYYY-MM-DD. */
export const utcDay = (date: Date): string => date.toISOString().slice(0, 10);
