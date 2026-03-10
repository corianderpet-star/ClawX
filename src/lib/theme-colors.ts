/**
 * Theme Color Presets & Utilities
 *
 * Each preset carries a reference hue, hand-tuned primary HSL values for light
 * and dark modes, and a swatch hex for the UI.  Surface colours (background,
 * card, secondary, muted, accent, border, input) are **derived** from the hue
 * so that the entire app recolours consistently.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ThemeColorPreset {
  /** Unique key stored in settings. '' = default (CSS-defined blue). */
  id: string;
  /** i18n key under appearance.colors.* */
  labelKey: string;
  /** Hex colour shown as the swatch circle in Settings */
  swatch: string;
  /** Reference hue (0-360) used to derive surface colours */
  hue: number;
  /** Hand-tuned primary / ring values */
  light: { primary: string; primaryForeground: string; ring: string };
  dark:  { primary: string; primaryForeground: string; ring: string };
}

/* ------------------------------------------------------------------ */
/*  Presets                                                            */
/* ------------------------------------------------------------------ */

export const THEME_COLOR_PRESETS: ThemeColorPreset[] = [
  {
    id: '', labelKey: 'blue', swatch: '#3b82f6', hue: 221,
    light: { primary: '221.2 83.2% 53.3%', primaryForeground: '210 40% 98%',   ring: '221.2 83.2% 53.3%' },
    dark:  { primary: '217.2 91.2% 59.8%', primaryForeground: '222.2 47.4% 11.2%', ring: '224.3 76.3% 48%' },
  },
  {
    id: 'violet', labelKey: 'violet', swatch: '#8b5cf6', hue: 262,
    light: { primary: '262.1 83.3% 57.8%', primaryForeground: '210 40% 98%',   ring: '262.1 83.3% 57.8%' },
    dark:  { primary: '263.4 70% 50.4%',   primaryForeground: '210 40% 98%',   ring: '263.4 70% 50.4%' },
  },
  {
    id: 'rose', labelKey: 'rose', swatch: '#f43f5e', hue: 347,
    light: { primary: '346.8 77.2% 49.8%', primaryForeground: '355.7 100% 97.3%', ring: '346.8 77.2% 49.8%' },
    dark:  { primary: '346.8 77.2% 49.8%', primaryForeground: '355.7 100% 97.3%', ring: '346.8 77.2% 49.8%' },
  },
  {
    id: 'orange', labelKey: 'orange', swatch: '#f97316', hue: 25,
    light: { primary: '24.6 95% 53.1%',  primaryForeground: '26 83.3% 14.1%', ring: '24.6 95% 53.1%' },
    dark:  { primary: '20.5 90.2% 48.2%', primaryForeground: '60 9.1% 97.8%',  ring: '20.5 90.2% 48.2%' },
  },
  {
    id: 'green', labelKey: 'green', swatch: '#22c55e', hue: 142,
    light: { primary: '142.1 76.2% 36.3%', primaryForeground: '355.7 100% 97.3%', ring: '142.1 76.2% 36.3%' },
    dark:  { primary: '142.1 70.6% 45.3%', primaryForeground: '144.9 80.4% 10%',  ring: '142.1 70.6% 45.3%' },
  },
  {
    id: 'amber', labelKey: 'amber', swatch: '#f59e0b', hue: 38,
    light: { primary: '37.7 92.1% 50.2%', primaryForeground: '26 83.3% 14.1%', ring: '37.7 92.1% 50.2%' },
    dark:  { primary: '43.3 96.4% 56.3%', primaryForeground: '26 83.3% 14.1%', ring: '43.3 96.4% 56.3%' },
  },
  {
    id: 'teal', labelKey: 'teal', swatch: '#14b8a6', hue: 173,
    light: { primary: '173.4 80.4% 40%',  primaryForeground: '166 76.5% 96.7%', ring: '173.4 80.4% 40%' },
    dark:  { primary: '172.5 66% 50.4%',  primaryForeground: '173.4 80.4% 10%', ring: '172.5 66% 50.4%' },
  },
  {
    id: 'slate', labelKey: 'slate', swatch: '#64748b', hue: 215,
    light: { primary: '215.4 16.3% 46.9%', primaryForeground: '210 40% 98%',       ring: '215.4 16.3% 46.9%' },
    dark:  { primary: '217.9 10.6% 64.9%', primaryForeground: '222.2 47.4% 11.2%', ring: '217.9 10.6% 64.9%' },
  },
];

/* ------------------------------------------------------------------ */
/*  CSS variable names we override                                     */
/* ------------------------------------------------------------------ */

const ALL_THEME_VARS = [
  '--background', '--foreground',
  '--card', '--card-foreground',
  '--popover', '--popover-foreground',
  '--primary', '--primary-foreground',
  '--secondary', '--secondary-foreground',
  '--muted', '--muted-foreground',
  '--accent', '--accent-foreground',
  '--border', '--input', '--ring',
] as const;

/* ------------------------------------------------------------------ */
/*  Palette generation from a hue                                      */
/* ------------------------------------------------------------------ */

/**
 * Generate the surface / chrome CSS variables from a hue value.
 * Primary, primary-foreground & ring are NOT included here – they are
 * supplied separately from hand-tuned preset values (or derived for
 * custom hex colours).
 */
function deriveSurfaceVars(hue: number, isDark: boolean): Record<string, string> {
  const h = Math.round(hue);

  if (isDark) {
    return {
      '--background':          `${h} 50% 3.9%`,
      '--foreground':          `${h} 10% 97.8%`,
      '--card':                `${h} 50% 4.5%`,
      '--card-foreground':     `${h} 10% 97.8%`,
      '--popover':             `${h} 50% 4.5%`,
      '--popover-foreground':  `${h} 10% 97.8%`,
      '--secondary':           `${h} 25% 14.5%`,
      '--secondary-foreground':`${h} 10% 97.8%`,
      '--muted':               `${h} 25% 14.5%`,
      '--muted-foreground':    `${h} 15% 63.9%`,
      '--accent':              `${h} 25% 14.5%`,
      '--accent-foreground':   `${h} 10% 97.8%`,
      '--border':              `${h} 25% 17%`,
      '--input':               `${h} 25% 17%`,
    };
  }

  return {
    '--background':          `${h} 30% 94%`,
    '--foreground':          `${h} 70% 4.1%`,
    '--card':                `${h} 12% 99%`,
    '--card-foreground':     `${h} 70% 4.1%`,
    '--popover':             `${h} 12% 99%`,
    '--popover-foreground':  `${h} 70% 4.1%`,
    '--secondary':           `${h} 22% 95%`,
    '--secondary-foreground':`${h} 47% 11%`,
    '--muted':               `${h} 22% 95%`,
    '--muted-foreground':    `${h} 14% 45%`,
    '--accent':              `${h} 22% 95%`,
    '--accent-foreground':   `${h} 47% 11%`,
    '--border':              `${h} 20% 90%`,
    '--input':               `${h} 20% 90%`,
  };
}

/* ------------------------------------------------------------------ */
/*  Hex → HSL helpers                                                  */
/* ------------------------------------------------------------------ */

export function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '';

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${(h * 360).toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}

/** Extract just the hue (0-360) from a hex string. */
function hexToHue(hex: string): number {
  const hsl = hexToHsl(hex);
  if (!hsl) return 0;
  return parseFloat(hsl.split(' ')[0]);
}

/**
 * Return a contrasting foreground HSL for a given hex primary colour.
 */
export function contrastForeground(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '210 40% 98%';
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '222.2 47.4% 11.2%' : '210 40% 98%';
}

/* ------------------------------------------------------------------ */
/*  Runtime helpers                                                    */
/* ------------------------------------------------------------------ */

export function isDarkMode(theme: string): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function clearAllOverrides(root: HTMLElement): void {
  for (const v of ALL_THEME_VARS) {
    root.style.removeProperty(v);
  }
}

function applyVars(root: HTMLElement, vars: Record<string, string>): void {
  for (const [key, val] of Object.entries(vars)) {
    root.style.setProperty(key, val);
  }
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                   */
/* ------------------------------------------------------------------ */

/**
 * Apply the chosen theme colour to **all** relevant CSS custom properties.
 * Call whenever `themeColor` or `theme` (light / dark / system) changes.
 */
export function applyThemeColor(themeColor: string, theme: string): void {
  const root = document.documentElement;
  const dark = isDarkMode(theme);

  // ── Default (blue): let the stylesheet-defined values take over ──
  if (themeColor === '') {
    clearAllOverrides(root);
    return;
  }

  // ── Known preset ──
  const preset = THEME_COLOR_PRESETS.find((p) => p.id === themeColor);
  if (preset) {
    const surface = deriveSurfaceVars(preset.hue, dark);
    const accent  = dark ? preset.dark : preset.light;

    applyVars(root, surface);
    root.style.setProperty('--primary',            accent.primary);
    root.style.setProperty('--primary-foreground',  accent.primaryForeground);
    root.style.setProperty('--ring',                accent.ring);
    return;
  }

  // ── Custom hex colour ──
  if (themeColor.startsWith('#') && (themeColor.length === 7 || themeColor.length === 4)) {
    const hsl = hexToHsl(themeColor);
    if (hsl) {
      const hue = hexToHue(themeColor);
      const fg  = contrastForeground(themeColor);

      applyVars(root, deriveSurfaceVars(hue, dark));
      root.style.setProperty('--primary',            hsl);
      root.style.setProperty('--primary-foreground',  fg);
      root.style.setProperty('--ring',                hsl);
    }
    return;
  }

  // ── Unknown value → reset ──
  clearAllOverrides(root);
}
