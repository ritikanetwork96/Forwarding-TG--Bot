import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../lib/utils';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration?: number;
}

export interface ToastContextType {
  toast: {
    (options: {
      title: string;
      description?: string;
      variant?: ToastVariant;
      duration?: number;
    }): void;
    success: (title: string, description?: string, duration?: number) => void;
    error: (title: string, description?: string, duration?: number) => void;
    warning: (title: string, description?: string, duration?: number) => void;
    info: (title: string, description?: string, duration?: number) => void;
  };
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({
      title,
      description,
      variant = 'info',
      duration = 4000,
    }: {
      title: string;
      description?: string;
      variant?: ToastVariant;
      duration?: number;
    }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = { id, title, description, variant, duration };

      setToasts((prev) => [...prev.slice(-4), newToast]); // keep max 5 active

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toastHelpers = Object.assign(
    (options: { title: string; description?: string; variant?: ToastVariant; duration?: number }) =>
      showToast(options),
    {
      success: (title: string, description?: string, duration?: number) =>
        showToast({ title, description, variant: 'success', duration }),
      error: (title: string, description?: string, duration?: number) =>
        showToast({ title, description, variant: 'error', duration }),
      warning: (title: string, description?: string, duration?: number) =>
        showToast({ title, description, variant: 'warning', duration }),
      info: (title: string, description?: string, duration?: number) =>
        showToast({ title, description, variant: 'info', duration }),
    }
  );

  return (
    <ToastContext.Provider value={{ toast: toastHelpers, removeToast }}>
      {children}

      {/* Fixed Toast Container */}
      <aside
        aria-label="Notifications"
        className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-[100] flex flex-col gap-2.5 pointer-events-none"
      >
        {toasts.map((item) => {
          const icons = {
            success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />,
            error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />,
            warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
            info: <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />,
          };

          const borderColors = {
            success: 'border-emerald-500/30 bg-slate-900/95 shadow-emerald-500/10',
            error: 'border-rose-500/30 bg-slate-900/95 shadow-rose-500/10',
            warning: 'border-amber-500/30 bg-slate-900/95 shadow-amber-500/10',
            info: 'border-sky-500/30 bg-slate-900/95 shadow-sky-500/10',
          };

          return (
            <div
              key={item.id}
              role="alert"
              className={cn(
                'pointer-events-auto p-3.5 rounded-xl border backdrop-blur-md shadow-xl flex items-start gap-3 transition-all duration-200 animate-slide-in-up',
                borderColors[item.variant]
              )}
            >
              {icons[item.variant]}
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-slate-100 leading-tight">
                  {item.title}
                </p>
                {item.description && (
                  <p className="text-xs text-slate-400 mt-1 leading-normal break-words">
                    {item.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeToast(item.id)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800/80 transition-colors shrink-0"
                aria-label="Dismiss toast"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </aside>
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
