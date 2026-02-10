/**
 * useConnectivity Hook
 *
 * Monitors network connectivity state.
 * Components use this to show online/offline indicators.
 */

import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useConnectivity(): boolean {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? true);
    });
    return () => unsubscribe();
  }, []);

  return isConnected;
}
