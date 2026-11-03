import React, { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

/**
 * Système de notifications toast (audit Z3) : remplace les window.alert()
 * bloquants. Empilage animé en haut à droite, auto-fermeture, fermeture manuelle.
 * Usage : const toast = useToast(); toast.success('…'); toast.error('…'); toast.info('…');
 */

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

const STYLES: Record<ToastKind, { icon: typeof CheckCircle2; ring: string; iconClass: string; bar: string }> = {
  success: { icon: CheckCircle2, ring: 'border-emerald-200', iconClass: 'text-emerald-600', bar: 'bg-emerald-500' },
  error: { icon: AlertCircle, ring: 'border-red-200', iconClass: 'text-red-600', bar: 'bg-red-500' },
  info: { icon: Info, ring: 'border-blue-200', iconClass: 'text-blue-600', bar: 'bg-blue-500' },
};

let toastSeq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++toastSeq;
    setItems(prev => [...prev.slice(-3), { id, kind, message }]);
    window.setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  const api: ToastApi = {
    success: (m: string) => push('success', m),
    error: (m: string) => push('error', m),
    info: (m: string) => push('info', m),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Conteneur : haut droite, sous les headers, au-dessus des pages */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        <AnimatePresence>
          {items.map(t => {
            const style = STYLES[t.kind];
            const Icon = style.icon;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 60, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className={`pointer-events-auto relative overflow-hidden flex items-start gap-3 bg-white border ${style.ring} shadow-xl rounded-xl p-3.5 pl-4`}
              >
                <span className={`absolute left-0 top-0 bottom-0 w-1 ${style.bar}`} />
                <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${style.iconClass}`} />
                <p className="text-sm text-slate-700 leading-snug flex-1">{t.message}</p>
                <button
                  onClick={() => dismiss(t.id)}
                  className="text-slate-300 hover:text-slate-600 transition-colors shrink-0"
                  aria-label="Fermer la notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
