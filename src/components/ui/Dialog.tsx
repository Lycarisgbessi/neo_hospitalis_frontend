import React, { useEffect } from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

// Dialog accessible avec animation d'entrée/ sortie :
// - backdrop fade + panneau scale-in (audit Z4)
// - fermeture par ÉCHAP et clic hors zone
// - verrouillage du scroll de la page tant qu'il est ouvert
// - tailles adaptables (md par défaut, lg pour les larges contenus)

const SIZES: Record<string, string> = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  size?: keyof typeof SIZES;
}

export function Dialog({ open, onOpenChange, children, size = 'md' }: DialogProps) {
  // ÉCHAP pour fermer + verrou de scroll (audit Z4)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop animé */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => onOpenChange(false)}
      />
      {/* Panneau animé : scale + fade + slide léger — hauteur bornée avec scroll (audit V5) */}
      <div
        className={cn(
          'z-50 w-full gap-4 border bg-white p-6 shadow-2xl sm:rounded-2xl rounded-xl relative max-h-[88vh] overflow-y-auto',
          'animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-250',
          SIZES[size]
        )}
      >
        {children}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 hover:rotate-90 focus:outline-none focus:ring-2 focus:ring-slate-300"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left mb-4', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-slate-500', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4', className)} {...props} />;
}
