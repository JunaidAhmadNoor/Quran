export const THEME_KEY = 'tilawah-theme';
export type ThemeChoice = 'light' | 'dark' | 'system';
const EVENT = 'tilawah-theme-change';

/** Runs before paint (inline, with the CSP nonce) so there is no flash of the wrong theme. */
export const themeScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}})();`;

export function readTheme(): ThemeChoice {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  if (choice === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
  window.dispatchEvent(new Event(EVENT));
}

/** For useSyncExternalStore: theme changes from this tab or another one. */
export function subscribeTheme(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}
