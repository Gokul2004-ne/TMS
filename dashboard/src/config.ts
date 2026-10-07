export const CONFIG = {
  // Toggle between mock fixtures and live FastAPI backend
  USE_MOCK: false,
  API_BASE: 'http://localhost:8000',
  POLL_INTERVAL_MS: 15000,
  OFFICE_PLATFORM_URL: 'https://krishna-caare.github.io/novaarc-rcm/login',
  
  APP_COLORS: {
    'NovaArc RCM': '#4f46e5',  // Indigo
    ClaimPlatform: '#8b5cf6',  // Violet
    Chrome: '#2563eb',         // Blue
    Edge: '#0284c7',           // Ocean Blue
    Excel: '#16a34a',          // Green
    'TMS Dashboard': '#0d9488',// Teal
    'Create React App Sample': '#ec4899', // Pink
    Outlook: '#0078d4',        // Deep Blue
    'MS Teams': '#7c3aed',     // Purple
    Acrobat: '#dc2626',        // Red
    'Adobe Acrobat': '#dc2626',// Red
    BillingPortal: '#ea580c',  // Orange
    YouTube: '#ff0033',        // YouTube Red
    Bing: '#10b981',           // Mint Emerald
    Word: '#1d4ed8',           // Royal Blue
    PowerPoint: '#c2410c',     // Amber Rust
    Notepad: '#ca8a04',        // Gold
    Desktop: '#8b5cf6',        // Violet
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
