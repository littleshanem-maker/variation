/**
 * useConnectivity Hook
 */

import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useConnectivity(): boolean {
  const [connected, setConnected] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setConnected(state.isConnected === true);
    });
    return () => unsubscribe();
  }, []);

  return connected;
}
