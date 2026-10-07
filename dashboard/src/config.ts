export const CONFIG = {
  // Toggle between mock fixtures and live FastAPI backend
  USE_MOCK: false,
  API_BASE: 'http://localhost:8000',
  POLL_INTERVAL_MS: 15000,
  OFFICE_PLATFORM_URL: 'https://krishna-caare.github.io/novaarc-rcm/login',
  
  APP_COLORS: {
    'NovaArc RCM': '#4f46e5',  // Company Core Office Platform Indigo
    ClaimPlatform: '#4f46e5',  // Modern Enterprise Indigo
    Chrome: '#0284c7',         // Ocean / Browser Blue
    Excel: '#16a34a',          // Forest Emerald Green
    BillingPortal: '#7c3aed',  // Royal Violet
    Edge: '#0ea5e9',           // Sky Blue
    Acrobat: '#dc2626',        // Crimson
    Other: '#64748b',          // Slate
    Idle: '#d97706',           // Warm Amber
  } as Record<string, string>,

  NVA_CONFIG: {
    EXCEL_OVERUSE: { label: 'Excel Overuse', color: '#15803d', bg: '#f0fdf4' },
    APP_SWITCHING: { label: 'App Switching', color: '#b45309', bg: '#fffbeb' },
    LONG_IDLE: { label: 'Long Idle', color: '#b91c1c', bg: '#fef2f2' },
    OUTLIER: { label: 'Outlier Duration', color: '#c2410c', bg: '#fff7ed' },
    REWORK: { label: 'Rework Touch', color: '#4338ca', bg: '#eef2ff' },
  } as Record<string, { label: string; color: string; bg: string }>
}
