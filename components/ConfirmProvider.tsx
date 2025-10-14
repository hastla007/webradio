import React, { createContext, useCallback, useContext, useState, useId } from 'react';
import StatusBadge from './StatusBadge';

export interface ConfirmOptions {
    title?: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: 'danger' | 'default';
}

interface ConfirmState {
    options: ConfirmOptions;
    resolve: (result: boolean) => void;
}

interface ConfirmContextValue {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

export const ConfirmProvider: React.FC<React.PropsWithChildren<unknown>> = ({ children }) => {
    const [state, setState] = useState<ConfirmState | null>(null);
    const titleId = useId();
    const descriptionId = useId();

    const dismiss = useCallback((result: boolean) => {
        setState(current => {
            if (current) {
                current.resolve(result);
            }
            return null;
        });
    }, []);

    const confirm = useCallback((options: ConfirmOptions) => {
        return new Promise<boolean>(resolve => {
            setState({ options, resolve });
        });
    }, []);

    const { title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'default' } = state?.options || {};
    const isDanger = tone === 'danger';

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {state && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-6">
                    <div className="absolute inset-0" onClick={() => dismiss(false)} />
                    <div
                        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-brand-border/60 bg-white p-6 shadow-xl dark:border-dark-border dark:bg-dark-surface"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        aria-describedby={description ? descriptionId : undefined}
                    >
                        <div className="flex items-center justify-between">
                            <h2 id={titleId} className="text-xl font-semibold text-brand-dark dark:text-dark-text">
                                {title ?? 'Are you sure?'}
                            </h2>
                            {isDanger && <StatusBadge status="warning" label="Confirm" size="sm" />}
                        </div>
                        {description && (
                            <p id={descriptionId} className="mt-3 text-sm text-brand-text-light dark:text-dark-text-light">
                                {description}
                            </p>
                        )}
                        <div className="mt-6 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => dismiss(false)}
                                className="rounded-lg border border-brand-border px-4 py-2 text-sm font-medium text-brand-text-light transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary dark:border-dark-border dark:text-dark-text-light dark:hover:bg-white/10"
                            >
                                {cancelLabel}
                            </button>
                            <button
                                type="button"
                                onClick={() => dismiss(true)}
                                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-primary ${
                                    isDanger
                                        ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500'
                                        : 'bg-brand-dark hover:bg-gray-800'
                                }`}
                            >
                                {confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
};

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context;
};

export default ConfirmProvider;
