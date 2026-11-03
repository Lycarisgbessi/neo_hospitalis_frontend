import React from 'react';
import { cn } from '../lib/utils';

/**
 * Coche de succès animée (SVG au trait dessiné progressivement) —
 * utilisée par le wizard de configuration et les écrans de confirmation.
 */
export function SuccessCheck({ size = 72, className }: { size?: number; className?: string }) {
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      {/* Halo + anneaux d'annonce */}
      <span className="absolute inset-0 rounded-full bg-emerald-500/15 animate-in zoom-in-50 duration-300" />
      <span className="absolute -inset-3 rounded-full border border-emerald-500/30 animate-in fade-in expand duration-500" />
      <svg viewBox="0 0 52 52" className="relative w-full h-full" aria-hidden>
        <circle className="draw-circle" cx="26" cy="26" r="24" fill="none" stroke="rgb(16 185 129)" strokeWidth="2.5" strokeLinecap="round" />
        <path className="draw-check" fill="none" stroke="rgb(16 185 129)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" d="M14 27l8 8 16-17" />
      </svg>
    </div>
  );
}
