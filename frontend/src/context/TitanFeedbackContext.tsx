import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import './TitanFeedback.css';

// ── Types ──────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  exiting?: boolean;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface TitanFeedbackContextValue {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
  };
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const TitanFeedbackContext = createContext<TitanFeedbackContextValue | null>(null);

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useTitanFeedback(): TitanFeedbackContextValue {
  const ctx = useContext(TitanFeedbackContext);
  if (!ctx) throw new Error('useTitanFeedback must be used within TitanFeedbackProvider');
  return ctx;
}

// ── Provider ───────────────────────────────────────────────────────────────────

let nextToastId = 1;

export const TitanFeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // ── Toast ──

  const dismissToast = useCallback((id: number) => {
    // Mark exiting for animation
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = nextToastId++;
    setToasts(prev => [...prev, { id, message, type }]);
    const duration = type === 'error' ? 6000 : 4000;
    const timer = setTimeout(() => dismissToast(id), duration);
    timersRef.current.set(id, timer);
  }, [dismissToast]);

  const toast = {
    success: (msg: string) => showToast(msg, 'success'),
    error: (msg: string) => showToast(msg, 'error'),
    warning: (msg: string) => showToast(msg, 'warning'),
    info: (msg: string) => showToast(msg, 'info'),
  };

  // ── Confirm ──

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      setConfirmState({ options: opts, resolve });
    });
  }, []);

  const handleConfirm = useCallback((value: boolean) => {
    if (confirmState) {
      confirmState.resolve(value);
      setConfirmState(null);
    }
  }, [confirmState]);

  const value: TitanFeedbackContextValue = { toast, confirm };

  return (
    <TitanFeedbackContext.Provider value={value}>
      {children}

      {/* ── Toast Container ── */}
      {toasts.length > 0 && (
        <div className="titan-toast-container">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`titan-toast titan-toast--${t.type}${t.exiting ? ' titan-toast--exit' : ''}`}
              onClick={() => dismissToast(t.id)}
            >
              <div className="titan-toast__icon">
                {t.type === 'success' && (
                  <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                )}
                {t.type === 'error' && (
                  <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                )}
                {t.type === 'warning' && (
                  <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                )}
                {t.type === 'info' && (
                  <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                )}
              </div>
              <div className="titan-toast__content">
                <span className="titan-toast__brand">Titan</span>
                <p className="titan-toast__message">{t.message}</p>
              </div>
              <button className="titan-toast__close" onClick={(e) => { e.stopPropagation(); dismissToast(t.id); }}>
                <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Confirm Dialog ── */}
      {confirmState && (
        <div className="titan-confirm-overlay" onClick={() => handleConfirm(false)}>
          <div className="titan-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="titan-confirm__header">
              <div className="titan-confirm__brand">Titan</div>
              <h3 className="titan-confirm__title">{confirmState.options.title || 'Confirm'}</h3>
            </div>
            <div className="titan-confirm__body">
              <p>{confirmState.options.message}</p>
            </div>
            <div className="titan-confirm__footer">
              <button
                className="titan-confirm__btn titan-confirm__btn--cancel"
                onClick={() => handleConfirm(false)}
              >
                {confirmState.options.cancelText || 'Cancel'}
              </button>
              <button
                className={`titan-confirm__btn ${confirmState.options.danger ? 'titan-confirm__btn--danger' : 'titan-confirm__btn--confirm'}`}
                onClick={() => handleConfirm(true)}
                autoFocus
              >
                {confirmState.options.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </TitanFeedbackContext.Provider>
  );
};
