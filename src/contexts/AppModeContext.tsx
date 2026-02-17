/**
 * App Mode Context — Field vs Office
 *
 * Field mode (default): Capture-focused, no values, limited status control.
 * Office mode (PIN-protected): Full access, values, exports, project management.
 *
 * Default PIN: 1234
 */

import { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { fieldColors, officeColors } from '../theme';

export type AppMode = 'field' | 'office';

interface AppModeContextType {
  mode: AppMode;
  isOffice: boolean;
  isField: boolean;
  colors: typeof fieldColors;
  switchToOffice: (pin: string) => boolean;
  switchToField: () => void;
}

const AppModeContext = createContext<AppModeContextType>({
  mode: 'field',
  isOffice: false,
  isField: true,
  colors: fieldColors,
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

  const activeColors = useMemo(() => mode === 'office' ? officeColors : fieldColors, [mode]);

  return (
    <AppModeContext.Provider value={{
      mode,
      isOffice: mode === 'office',
      isField: mode === 'field',
      colors: activeColors,
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

/** Shortcut — returns the active color palette based on field/office mode */
export function useThemeColors() {
  const { colors } = useContext(AppModeContext);
  return colors;
}
