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

  const executeRefresh = useCallback(async () => {
    try {
      await savedCallback.current()
      setLastUpdated(new Date())
    } finally {
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
          executeRefresh()
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
