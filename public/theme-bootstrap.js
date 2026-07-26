(() => {
  const storageKey = 'theme-preference';
  const legacyKey = 'national-theme';
  const saved = localStorage.getItem(storageKey) || localStorage.getItem(legacyKey) || 'system';
  const mode = ['light', 'dark', 'system'].includes(saved) ? saved : 'system';
  const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  document.documentElement.dataset.theme = resolved;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.style.colorScheme = resolved;
})();
