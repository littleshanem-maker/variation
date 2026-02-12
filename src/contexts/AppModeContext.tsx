/**
 * App Mode Context — Field vs Office
 *
 * Field mode (default): Capture-focused, no values, limited status control.
 * Office mode (PIN-protected): Full access, values, exports, project management.
 *
 * Default PIN: 1234
 */

import { createContext, useContext, useState, ReactNode } from 'react';

export type AppMode = 'field' | 'office';

interface AppModeContextType {
  mode: AppMode;
  isOffice: boolean;
  isField: boolean;
  switchToOffice: (pin: string) => boolean;
  switchToField: () => void;
}

const AppModeContext = createContext<AppModeContextType>({
  mode: 'field',
  isOffice: false,
  isField: true,
  switchToOffice: () => false,
  switchToField: () => {},
});

const OFFICE_PIN = '1234';

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AppMode>('field');

  const switchToOffice = (pin: string): boolean => {
    if (pin === OFFICE_PIN) {
      setMode('office');
      return true;
    }
    return false;
  };

  const switchToField = () => {
    setMode('field');
  };

  return (
    <AppModeContext.Provider value={{
      mode,
      isOffice: mode === 'office',
      isField: mode === 'field',
      switchToOffice,
      switchToField,
    }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  return useContext(AppModeContext);
}
