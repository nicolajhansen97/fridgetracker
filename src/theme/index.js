// Freezely design tokens.
// Import via: import { colors, gradients, radii, shadows, spacing, typography } from '../theme';

export const colors = {
  // Brand
  primary: '#14B8A6',      // teal-500 — solid accent for icons, links, focus
  primaryDark: '#0D9488',  // teal-600 — pressed/hover
  secondary: '#6366F1',    // indigo-500 — gradient end, secondary emphasis

  // Surfaces
  bg: '#F8FAFC',           // slate-50 — screen background
  surface: '#FFFFFF',      // cards, sheets
  surfaceMuted: '#F1F5F9', // slate-100 — subtle fills (icon bg, inactive chips)

  // Text
  text: '#0F172A',         // slate-900 — primary text
  textMuted: '#64748B',    // slate-500 — secondary text
  textSubtle: '#94A3B8',   // slate-400 — placeholder, timestamps

  // Borders / dividers
  border: '#E2E8F0',       // slate-200
  borderStrong: '#CBD5E1', // slate-300

  // Semantic
  danger: '#EF4444',       // red-500 — delete, errors, expiring soon
  dangerSoft: '#FEE2E2',   // red-100 — error backgrounds
  warning: '#F59E0B',      // amber-500
  warningSoft: '#FEF3C7',  // amber-100
  success: '#10B981',      // emerald-500
  successSoft: '#D1FAE5',  // emerald-100
  info: '#0EA5E9',         // sky-500
  infoSoft: '#E0F2FE',     // sky-100

  // Translucent overlays (over the gradient header)
  whiteAlpha20: 'rgba(255,255,255,0.20)',
  whiteAlpha30: 'rgba(255,255,255,0.30)',
  whiteAlpha80: 'rgba(255,255,255,0.85)',
};

export const gradients = {
  // The single hero gradient used for headers, primary buttons, FABs.
  hero: ['#14B8A6', '#6366F1'],
  // Soft fade used for subtle backgrounds (e.g. login bg).
  heroSoft: ['#5EEAD4', '#A5B4FC'],
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
  header: 24,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const shadows = {
  // Subtle elevation for cards.
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  // Slightly stronger for primary buttons / floating elements.
  button: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  // For floating action buttons.
  fab: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
};

export const typography = {
  // Headings
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4 },
  h2: { fontSize: 22, fontWeight: '700', letterSpacing: -0.2 },
  h3: { fontSize: 18, fontWeight: '700', letterSpacing: -0.1 },

  // Body
  body: { fontSize: 15, fontWeight: '400' },
  bodyStrong: { fontSize: 15, fontWeight: '600' },
  bodySmall: { fontSize: 13, fontWeight: '400' },

  // Labels / metadata
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  caption: { fontSize: 12, fontWeight: '400' },
  button: { fontSize: 16, fontWeight: '600', letterSpacing: 0.1 },
};
