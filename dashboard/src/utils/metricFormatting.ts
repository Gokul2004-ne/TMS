export interface FormattedAht {
  display: string
  isOutlier: boolean
  warning?: string
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
      display: `${(targetMinutes * 2).toFixed(1)}m*`,
      isOutlier: true,
      warning: `Stale Session: Multi-day leak detected (${ahtMinutes.toFixed(1)}m actual) — sanitized to benchmark ceiling`
    }
  }

  // Exceeds 2x target benchmark
  if (ahtMinutes > targetMinutes * 2) {
    return {
      display: `${(targetMinutes * 2).toFixed(1)}m+`,
      isOutlier: true,
      warning: `AHT exceeds 2x target benchmark (${ahtMinutes.toFixed(1)}m actual)`
    }
  }

  return {
    display: `${ahtMinutes.toFixed(1)}m`,
    isOutlier: false
  }
}
