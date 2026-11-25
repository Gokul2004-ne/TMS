const resolveApiBase = (): string => {
  try {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const queryApi = urlParams.get('api')
      if (queryApi) {
        const cleanQuery = queryApi.trim().replace(/\/+$/, '')
        localStorage.setItem('TMS_API_BASE', cleanQuery)
        return cleanQuery
      }
      const isHttps = window.location.protocol === 'https:'
      const isPagesDev = window.location.hostname.endsWith('.pages.dev')
      if (isPagesDev) {
        // Use Cloudflare Pages same-origin proxy function (/tms-api -> Hostinger) to avoid CORS blocks
        return `${window.location.origin}/tms-api`
      }
      const savedApi = localStorage.getItem('TMS_API_BASE')
      if (savedApi && savedApi.trim().length > 0) {
        if (
          savedApi.includes('localhost:8000') ||
          savedApi.includes('127.0.0.1:8000') ||
          savedApi.includes('catalystappsail') ||
          (isHttps && (savedApi.startsWith('http://') || savedApi.includes('187.127.207.41') || savedApi.includes('frccind.com')))
        ) {
          // Skip local DB or CORS-restricted cached bases so everything points to Live Cloud DB
        } else {
          return savedApi.trim().replace(/\/+$/, '')
        }
      }
      if (isHttps) {
        return 'https://frccind.com/tms-api'
      }
    }
  } catch {}
  const envBase = (import.meta as any).env?.VITE_API_BASE
  if (envBase && typeof envBase === 'string' && envBase.trim().length > 0) {
    return envBase.trim().replace(/\/+$/, '')
  }
  return typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? 'https://frccind.com/tms-api'
    : `${typeof window !== 'undefined' ? window.location.origin : ''}/tms-api`
}

export const CONFIG = {
  // Toggle between mock fixtures and live FastAPI backend
  USE_MOCK: false,
  // Live cloud backend on Render
  API_BASE: resolveApiBase(),
  POLL_INTERVAL_MS: 1000,
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