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
  const intervalSec = options.intervalSec ?? 5
  const enabled = options.enabled ?? true

  const [isPolling, setIsPolling] = useState<boolean>(enabled)
  const [countdown, setCountdown] = useState<number>(intervalSec)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const savedCallback = useRef(callback)
  const isExecutingRef = useRef(false)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  const executeRefresh = useCallback(async () => {
    if (isExecutingRef.current) return
    isExecutingRef.current = true
    try {
      await savedCallback.current()
      setLastUpdated(new Date())
    } catch (err) {
      // Quietly handle errors in background polling to prevent retry cascades
    } finally {
      isExecutingRef.current = false
      setCountdown(intervalSec)
    }
  }, [intervalSec])

  const togglePolling = useCallback(() => {
    setIsPolling(prev => !prev)
  }, [])

  useEffect(() => {
    if (!isPolling) return

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Trigger execution cleanly outside of the state setter
          Promise.resolve().then(() => {
            executeRefresh()
          })
          return intervalSec
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isPolling, intervalSec, executeRefresh])

  return {
    countdown,
    isPolling,
    lastUpdated,
    refreshNow: executeRefresh,
    togglePolling
  }
}
