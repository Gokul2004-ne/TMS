export const CONFIG = {
  // Toggle between mock fixtures and live FastAPI backend
  USE_MOCK: true,
  API_BASE: 'http://localhost:8000',
  POLL_INTERVAL_MS: 15000,
  
  APP_COLORS: {
    ClaimPlatform: '#8b5cf6',
    Chrome: '#38bdf8',
    Excel: '#10b981',
    BillingPortal: '#6366f1',
    Edge: '#0284c7',
    Acrobat: '#ef4444',
    Other: '#94a3b8',
    Idle: '#f59e0b',
  } as Record<string, string>,

  NVA_CONFIG: {
    EXCEL_OVERUSE: { label: 'Excel Overuse', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    APP_SWITCHING: { label: 'App Switching', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    LONG_IDLE: { label: 'Long Idle', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    OUTLIER: { label: 'Outlier Duration', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
    REWORK: { label: 'Rework Touch', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
  } as Record<string, { label: string; color: string; bg: string }>
}
