'use client'

import { useState, useEffect } from 'react'
import { registerServiceWorker, subscribeToPush, getExistingSubscription } from '@/lib/pushNotifications'

export default function PushNotificationBanner() {
  const [visible, setVisible] = useState(false)
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    if (Notification.permission === 'denied') return
    checkShouldShow()
  }, [])

  async function checkShouldShow() {
    try {
      // Tjek server-side om brugeren har dismissed eller er subscribed
      const [dismissedRes, subscriptionRes] = await Promise.all([
        fetch('/api/push-dismissed'),
        fetch('/api/push-subscription'),
      ])
      const { push_dismissed } = await dismissedRes.json()
      const { subscribed } = await subscriptionRes.json()

      if (push_dismissed || subscribed) return
      setVisible(true)
    } catch {
      // Ignorer fejl — vis ikke banneret ved netværksfejl
    }
  }

  async function markDismissed() {
    try {
      await fetch('/api/push-dismissed', { method: 'POST' })
    } catch {
      // Best effort
    }
  }

  async function handleSubscribe() {
    setSubscribing(true)

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      await markDismissed()
      setVisible(false)
      setSubscribing(false)
      return
    }

    const registration = await registerServiceWorker()
    if (!registration) {
      setSubscribing(false)
      return
    }

    let subscription = await getExistingSubscription(registration)
    if (!subscription) {
      subscription = await subscribeToPush(registration)
    }

    if (subscription) {
      await fetch('/api/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })
    }

    await markDismissed()
    setVisible(false)
    setSubscribing(false)
  }

  async function handleDismiss() {
    await markDismissed()
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3 mb-4 rounded-sm"
      style={{ background: '#2C4A3E', color: '#F2EDE4' }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-lg shrink-0" role="img" aria-label="bell">🔔</span>
        <p className="font-body text-sm" style={{ color: 'rgba(242,237,228,0.85)' }}>
          Få reminder om bet-deadline?
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleSubscribe}
          disabled={subscribing}
          className="font-condensed font-bold text-xs uppercase tracking-[0.08em] px-4 py-2 rounded-sm transition-colors min-h-[36px]"
          style={{ background: '#B8963E', color: '#F2EDE4' }}
        >
          {subscribing ? 'Vent...' : 'Ja tak'}
        </button>
        <button
          onClick={handleDismiss}
          className="font-condensed text-xs uppercase tracking-[0.08em] px-2 py-2 rounded-sm transition-opacity opacity-50 hover:opacity-100"
          style={{ color: '#F2EDE4' }}
        >
          Nej
        </button>
      </div>
    </div>
  )
}
