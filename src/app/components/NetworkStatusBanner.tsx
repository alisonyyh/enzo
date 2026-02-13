import { useState, useEffect } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

type BannerState = 'connected' | 'offline' | 'syncing' | 'failed';

export function NetworkStatusBanner() {
  const [state, setState] = useState<BannerState>('connected');
  const [showConnected, setShowConnected] = useState(false);

  useEffect(() => {
    // Listen to Firestore connection state
    const unsubscribe = onSnapshot(
      doc(db, '.info/connected') as any,
      (snapshot) => {
        const isConnected = snapshot.data()?.connected ?? false;

        if (isConnected) {
          setState('connected');
          setShowConnected(true);
          setTimeout(() => setShowConnected(false), 2000); // Auto-dismiss after 2s
        } else {
          setState('offline');
        }
      },
      (error) => {
        console.error('Connection state error:', error);
        setState('failed');
      }
    );

    return unsubscribe;
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
