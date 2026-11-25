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
  const { intervalSec = 15, enabled = true } = options
  const [isPolling, setIsPolling] = useState<boolean>(enabled)
  const [countdown, setCountdown] = useState<number>(intervalSec)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const savedCallback = useRef(callback)
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  // Tracks whether a refresh is currently in flight to prevent double-firing
  const isRefreshing = useRef(false)

  const executeRefresh = useCallback(async () => {
    if (isRefreshing.current) return
    isRefreshing.current = true
    try {
      await savedCallback.current()
      setLastUpdated(new Date())
    } catch (err) {
      console.error('[useLivePolling] poll error:', err)
    } finally {
      isRefreshing.current = false
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
          // Defer async fetch cleanly outside React state updater
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
