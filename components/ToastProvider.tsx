import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastOptions {
    type?: ToastType;
    duration?: number;
}

interface ToastMessage {
    id: string;
    message: string;
    type: ToastType;
    duration: number;
}

interface ToastContextValue {
    addToast: (message: string, options?: ToastOptions) => string;
    removeToast: (id: string) => void;
}

type ToastHandledError = Error & { __toastHandled?: boolean };

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DEFAULT_DURATION = 4000;

const typeStyles: Record<ToastType, string> = {
    info: 'border-blue-200 bg-white text-blue-900 dark:border-blue-900/60 dark:bg-brand-dark-surface dark:text-blue-200',
    success: 'border-green-200 bg-white text-green-900 dark:border-green-900/60 dark:bg-brand-dark-surface dark:text-green-200',
    warning: 'border-amber-200 bg-white text-amber-900 dark:border-amber-900/60 dark:bg-brand-dark-surface dark:text-amber-200',
    error: 'border-red-200 bg-white text-red-900 dark:border-red-900/60 dark:bg-brand-dark-surface dark:text-red-200',
};

const typeAccent: Record<ToastType, string> = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const addToast = useCallback<ToastContextValue['addToast']>((message, options) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const toast: ToastMessage = {
            id,
            message,
            type: options?.type ?? 'info',
            duration: options?.duration ?? TOAST_DEFAULT_DURATION,
        };
        setToasts(prev => [...prev, toast]);

        if (toast.duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, toast.duration);
        }

        return id;
    }, [removeToast]);

    const value = useMemo<ToastContextValue>(() => ({ addToast, removeToast }), [addToast, removeToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="fixed top-4 right-4 z-50 flex w-80 max-w-full flex-col gap-3">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg transition-all ${typeStyles[toast.type]}`}
                    >
                        <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${typeAccent[toast.type]}`} aria-hidden="true" />
                        <p className="flex-1 whitespace-pre-line text-sm leading-relaxed">{toast.message}</p>
                        <button
                            type="button"
                            onClick={() => removeToast(toast.id)}
                            className="ml-2 text-xs font-semibold uppercase tracking-wide text-inherit opacity-60 hover:opacity-100"
                        >
                            Dismiss
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const markToastHandled = (error: unknown) => {
    if (error instanceof Error) {
        (error as ToastHandledError).__toastHandled = true;
    }
};

export const wasToastHandled = (error: unknown): error is ToastHandledError => {
    return error instanceof Error && Boolean((error as ToastHandledError).__toastHandled);
};
