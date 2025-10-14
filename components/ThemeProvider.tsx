import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
    mode: ThemeMode;
    isDark: boolean;
    toggle: () => void;
    setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'theme';

const resolveInitialTheme = (): ThemeMode => {
    if (typeof window === 'undefined') {
        return 'light';
    }

    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
        return stored;
    }

    const mediaQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    return mediaQuery?.matches ? 'dark' : 'light';
};

export const ThemeProvider: React.FC<React.PropsWithChildren<unknown>> = ({ children }) => {
    const [mode, setModeState] = useState<ThemeMode>(resolveInitialTheme);

    useEffect(() => {
        if (typeof document === 'undefined' || typeof window === 'undefined') {
            return;
        }

        const root = document.documentElement;
        if (mode === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        root.dataset.theme = mode;
        try {
            window.localStorage.setItem(THEME_STORAGE_KEY, mode);
        } catch (error) {
            // Ignore storage errors (e.g., private browsing)
        }
    }, [mode]);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) {
            return;
        }

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (event: MediaQueryListEvent) => {
            setModeState(prev => {
                const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
                if (stored === 'dark' || stored === 'light') {
                    return stored;
                }
                return event.matches ? 'dark' : 'light';
            });
        };

        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    const setMode = useCallback((nextMode: ThemeMode) => {
        setModeState(nextMode);
    }, []);

    const toggle = useCallback(() => {
        setModeState(prev => (prev === 'dark' ? 'light' : 'dark'));
    }, []);

    const value = useMemo<ThemeContextValue>(
        () => ({
            mode,
            isDark: mode === 'dark',
            toggle,
            setMode,
        }),
        [mode, toggle, setMode]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export default ThemeProvider;
