import { useState, useEffect, useCallback, useRef } from 'react'

interface UseLivePollingOptions {
  intervalSec?: number
  enabled?: boolean
}

interface UseLivePollingResult {
  countdown: number
  isPolling: boolean
  lastUpdated: Date | null
  refreshNow: () => Promise<void>
  togglePolling: () => void
}

export function useLivePolling(
  callback: () => Promise<void>,
  options: UseLivePollingOptions = {}
): UseLivePollingResult {
  const { intervalSec = 3, enabled = true } = options
  const [isPolling, setIsPolling] = useState<boolean>(enabled)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const savedCallback = useRef(callback)
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  const executeRefresh = useCallback(async () => {
    try {
      await savedCallback.current()
      setLastUpdated(new Date())
    } catch {}
  }, [])

  const togglePolling = useCallback(() => {
    setIsPolling(prev => !prev)
  }, [])

  useEffect(() => {
    if (!isPolling) return

    const timer = setInterval(() => {
      executeRefresh()
    }, Math.max(1, intervalSec) * 1000)

    return () => clearInterval(timer)
  }, [isPolling, intervalSec, executeRefresh])

  return {
    countdown: intervalSec,
    isPolling,
    lastUpdated,
    refreshNow: executeRefresh,
    togglePolling
  }
}
