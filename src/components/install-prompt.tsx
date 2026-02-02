'use client'

import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(true) // Default to true to avoid flash

  useEffect(() => {
    // Check if running as installed PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true

    setIsInstalled(isStandalone)

    // Listen for the beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
      setIsInstalled(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return

    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice

    if (outcome === 'accepted') {
      setIsInstalled(true)
    }
    setInstallPrompt(null)
  }

  if (isInstalled) {
    return null
  }

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="text-2xl">📲</div>
        <div>
          <p className="text-white font-medium">Install the App</p>
          <p className="text-zinc-400 text-sm">Add Stuber Bowl to your home screen for the best experience</p>
        </div>
      </div>
      {installPrompt ? (
        <button
          onClick={handleInstall}
          className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
        >
          Install Now
        </button>
      ) : (
        <p className="text-zinc-500 text-xs text-center">
          Tap the share button and select &quot;Add to Home Screen&quot;
        </p>
      )}
    </div>
  )
}
