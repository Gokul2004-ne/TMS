export interface FormattedAht {
  display: string
  isOutlier: boolean
  warning?: string
}

/**
 * Safely parses an ISO date string from the server.
 * If the string lacks a timezone offset ('Z' or '+XX:XX'), appends 'Z' to treat it as UTC.
 */
export function parseServerDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null
  const trimmed = dateStr.trim()
  if (!trimmed) return null
  if (trimmed.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed)
    return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(trimmed + 'Z')
  return isNaN(d.getTime()) ? null : d
}

export function formatDuration(sec: number): string {
  const clamped = Math.max(0, Math.floor(sec || 0))
  const mins = Math.floor(clamped / 60)
  return `${mins}m ${clamped % 60}s`
}

export function formatMmSs(sec: number): string {
  const clamped = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(clamped / 60)
  const s = clamped % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

/**
 * Formats AHT display with outlier protection and stale session warnings.
 * Caps display at target * 2 for extreme outliers to avoid UI layout breaking,
 * and surfaces warnings when multi-day duration leaks occur.
 */
export function formatAhtDisplay(
  ahtMinutes: number | undefined | null,
  targetMinutes: number = 9.0,
  completedCount?: number
): FormattedAht {
  if (completedCount !== undefined && completedCount === 0) {
    return { display: '—', isOutlier: false }
  }
  if (!ahtMinutes || ahtMinutes <= 0) {
    return { display: '—', isOutlier: false }
  }

  // Multi-day session or extreme outlier (> 8 hours / 480 mins)
  if (ahtMinutes > 480) {
    return {
      display: `${ahtMinutes.toFixed(1)}m*`,
      isOutlier: true,
      warning: `Stale Session: Multi-day leak detected (${ahtMinutes.toFixed(1)}m actual)`
    }
  }

  // Exceeds 2x target benchmark
  if (ahtMinutes > targetMinutes * 2) {
    return {
      display: `${ahtMinutes.toFixed(1)}m`,
      isOutlier: true,
      warning: `AHT exceeds target benchmark (${ahtMinutes.toFixed(1)}m actual vs ${targetMinutes.toFixed(1)}m target)`
    }
  }

  return {
    display: `${ahtMinutes.toFixed(1)}m`,
    isOutlier: false
  }
}
