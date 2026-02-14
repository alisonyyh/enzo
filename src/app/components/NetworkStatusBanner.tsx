import { useState, useEffect } from 'react';

type BannerState = 'connected' | 'offline' | 'syncing' | 'failed';

export function NetworkStatusBanner() {
  const [state, setState] = useState<BannerState>(navigator.onLine ? 'connected' : 'offline');
  const [showConnected, setShowConnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setState('connected');
      setShowConnected(true);
      setTimeout(() => setShowConnected(false), 2000);
    };

    const handleOffline = () => {
      setState('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (state === 'connected' && !showConnected) {
    return null; // Don't show banner when connected after auto-dismiss
  }

  const bannerConfig = {
    connected: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      message: '✓ Synced',
    },
    offline: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      message: '⚠️ You\'re offline. Changes will sync when connected.',
    },
    syncing: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      message: '⏳ Syncing changes...',
    },
    failed: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      message: '❌ Couldn\'t sync changes. Check your connection.',
    },
  };

  const config = bannerConfig[state];

  return (
    <div className={`${config.bg} border-b ${config.border} px-4 py-3 text-sm ${config.text} flex items-center justify-between`}>
      <span>{config.message}</span>
      {state === 'failed' && (
        <button
          onClick={() => window.location.reload()}
          className="underline font-medium"
        >
          Retry
        </button>
      )}
    </div>
  );
}
