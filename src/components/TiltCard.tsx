import React, { useRef, useState, useCallback } from 'react';
import { cn } from '../lib/utils';

/**
 * Carte avec effet 3D tilt — rotation perspective suivant le curseur.
 * La carte a un reflet lumineux (glare) qui suit la souris.
 * Usage : <TiltCard className="...">contenu</TiltCard>
 */
interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;      // degrés max de rotation
  scale?: number;        // facteur d'échelle au survol
  glare?: boolean;       // reflet lumineux
  onClick?: () => void;
}

export function TiltCard({ 
  children, 
  className = '', 
  maxTilt = 8, 
  scale = 1.02, 
  glare = true,
  onClick 
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('');
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;   // 0→1
    const py = (e.clientY - rect.top) / rect.height;    // 0→1

    const rotateX = (py - 0.5) * -2 * maxTilt;
    const rotateY = (px - 0.5) * 2 * maxTilt;

    setTransform(
      `perspective(800px) rotateX(${rotateX.toFixed(1)}deg) rotateY(${rotateY.toFixed(1)}deg) scale(${scale})`
    );
    if (glare) {
      setGlarePos({ x: px * 100, y: py * 100, opacity: 0.12 });
    }
  }, [maxTilt, scale, glare]);

  const handleLeave = useCallback(() => {
    setTransform('');
    setGlarePos({ x: 50, y: 50, opacity: 0 });
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={onClick}
      className={cn('relative transition-transform duration-200 ease-out will-change-transform', className)}
      style={{ transform: transform || undefined }}
    >
      {children}
      {glare && (
        <div
          className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,${glarePos.opacity}), transparent 60%)`,
            opacity: glarePos.opacity > 0 ? 1 : 0,
          }}
        />
      )}
    </div>
  );
}
