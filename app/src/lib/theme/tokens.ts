/**
 * LIMITBEYOND design tokens — the mobile-side source of truth for the same
 * palette agreed in docs/uisample/dashboard.html. Every screen and every
 * primitive in components/ui imports from here; nothing hardcodes a colour.
 *
 * Three things carry the look, same as the web mockup:
 *   1. A warm bloom behind everything (see Screen.tsx), not a flat fill.
 *   2. Frosted glass cards — translucent white over that bloom, blurred.
 *   3. Pill geometry — actions and chips fully round; cards 22px.
 */
export const colors = {
  ground: '#0B0A09', // warm near-black, not blue-black

  glowWarm: 'rgba(247,208,70,0.20)',
  glowDeep: 'rgba(230,160,30,0.14)',

  glass: 'rgba(255,255,255,0.048)',
  glass2: 'rgba(255,255,255,0.075)',
  glassLine: 'rgba(255,255,255,0.085)',
  glassLine2: 'rgba(255,255,255,0.14)',

  ink: '#FFFFFF',
  ink2: 'rgba(255,255,255,0.68)',
  dim: 'rgba(255,255,255,0.44)',

  // Golden yellow — deeper than lemon so it reads warm against the bloom.
  accent: '#F7D046',
  onAccent: '#17130A', // near-black: white on yellow is ~1.7:1, unreadable
  accentRgb: '247,208,70',

  good: '#3FD17C',
  alert: '#F04242',
} as const;

export const radius = {
  card: 22,
  field: 16,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  headline: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '500' as const },
  eyebrow: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.5 },
} as const;

/** Soft, low ambient shadow — used sparingly, only where something needs to
 *  lift (the primary action), never stamped on every card. */
export const shadow = {
  accent: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  soft: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 4,
  },
} as const;
