/**
 * Centralized Design System Tokens
 * Operations Control Center standard tokens for colors, typography, spacing, and semantic states.
 */

export const tokens = {
  colors: {
    sidebar: {
      bg: '#0f172a', // Slate 900
      bgSubtle: '#1e293b', // Slate 800
      border: '#334155', // Slate 700
      text: '#f8fafc',
      textMuted: '#94a3b8',
      activeBg: '#1e293b',
      activeText: '#38bdf8',
      hoverBg: '#1e293b80',
    },
    workspace: {
      bg: '#f8fafc', // Slate 50
      surface: '#ffffff',
      surfaceSubtle: '#f1f5f9', // Slate 100
      border: '#e2e8f0', // Slate 200
      borderSubtle: '#cbd5e1', // Slate 300
    },
    text: {
      primary: '#0f172a', // Slate 900
      secondary: '#475569', // Slate 600
      muted: '#94a3b8', // Slate 400
      inverse: '#ffffff',
    },
    semantic: {
      success: {
        bg: '#ecfdf5',
        border: '#a7f3d0',
        text: '#065f46',
        dot: '#10b981',
      },
      warning: {
        bg: '#fffbeb',
        border: '#fde68a',
        text: '#92400e',
        dot: '#f59e0b',
      },
      danger: {
        bg: '#fef2f2',
        border: '#fecaca',
        text: '#991b1b',
        dot: '#ef4444',
      },
      info: {
        bg: '#eff6ff',
        border: '#bfdbfe',
        text: '#1e40af',
        dot: '#3b82f6',
      },
      neutral: {
        bg: '#f1f5f9',
        border: '#e2e8f0',
        text: '#475569',
        dot: '#94a3b8',
      },
    },
  },
  typography: {
    fontSans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontMono: "'JetBrains Mono', monospace",
    scale: {
      pageTitle: 'text-lg font-bold text-slate-900 tracking-tight',
      sectionTitle: 'text-sm font-semibold text-slate-800 tracking-tight',
      cardTitle: 'text-xs font-semibold uppercase text-slate-500 tracking-wider',
      body: 'text-xs text-slate-700',
      caption: 'text-[11px] text-slate-500',
      mono: 'font-mono text-[11px]',
    },
  },
  radius: {
    xs: 'rounded-sm', // 2px
    sm: 'rounded-md', // 4px
    md: 'rounded-lg', // 6px
    lg: 'rounded-xl', // 8-12px (maximum for operational cards)
  },
  shadow: {
    xs: 'shadow-xs',
    subtle: 'shadow-xs border border-slate-200/80',
    elevated: 'shadow-md border border-slate-200',
  },
} as const;

export type SemanticStatus = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
