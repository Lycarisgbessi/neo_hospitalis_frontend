import React, { useRef, useEffect, useCallback } from 'react';

/**
 * Canvas de particules médicales — croix, cercles, plus-signes qui flottent
 * en profondeur avec parallaxe légère. Chaque particule a une teinte,
 * une vitesse et une oscillation sinusoïdale propre. Canvas GPU-friendly.
 */
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  type: 'cross' | 'circle' | 'plus' | 'pulse';
  color: string;
  opacity: number;
  phase: number;      // oscillation sinusoïdale
  phaseSpeed: number;
  rotation: number;
  rotationSpeed: number;
}

const COLORS = [
  'rgba(59, 130, 246, {a})',  // blue
  'rgba(139, 92, 246, {a})',  // violet
  'rgba(6, 182, 212, {a})',   // cyan
  'rgba(16, 185, 129, {a})',  // emerald
  'rgba(99, 102, 241, {a})',  // indigo
];

export function ParticleCanvas({ 
  density = 40, 
  className = '', 
  dark = false,
  speed = 0.4 
}: { 
  density?: number; 
  className?: string; 
  dark?: boolean;
  speed?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });

  const initParticles = useCallback((w: number, h: number) => {
    const particles: Particle[] = [];
    for (let i = 0; i < density; i++) {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const types: Particle['type'][] = ['cross', 'circle', 'plus', 'pulse'];
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * speed * 0.8,
        vy: (Math.random() - 0.5) * speed * 0.6 - 0.1,
        size: 3 + Math.random() * 8,
        type: types[Math.floor(Math.random() * types.length)],
        color,
        opacity: 0.06 + Math.random() * 0.14,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.008 + Math.random() * 0.02,
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - 0.5) * 0.012,
      });
    }
    particlesRef.current = particles;
  }, [density, speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvas.width = rect.width;
      canvas.height = rect.height;
      initParticles(rect.width, rect.height);
    };

    const onMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouse);

    const drawParticle = (p: Particle, w: number, h: number) => {
      const alpha = p.opacity * (0.5 + 0.5 * Math.sin(p.phase));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.strokeStyle = p.color.replace('{a}', String(alpha));
      ctx.lineWidth = 1.2;
      ctx.beginPath();

      switch (p.type) {
        case 'cross': // Croix médicale
          ctx.moveTo(-p.size, 0); ctx.lineTo(p.size, 0);
          ctx.moveTo(0, -p.size); ctx.lineTo(0, p.size);
          break;
        case 'plus': // Plus arrondi
          ctx.moveTo(-p.size * 0.6, 0); ctx.lineTo(p.size * 0.6, 0);
          ctx.moveTo(0, -p.size * 0.6); ctx.lineTo(0, p.size * 0.6);
          ctx.lineWidth = 2.5;
          break;
        case 'circle': // Cercle (cellule)
          ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
          break;
        case 'pulse': // Onde de pouls
          ctx.moveTo(-p.size, 0);
          ctx.lineTo(-p.size * 0.3, -p.size * 0.7);
          ctx.lineTo(0, 0);
          ctx.lineTo(p.size * 0.3, p.size * 0.7);
          ctx.lineTo(p.size, 0);
          break;
      }
      ctx.stroke();
      ctx.restore();
    };

    const animate = () => {
      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);

      // Parallaxe légère vers la souris
      const mx = (mouseRef.current.x - w / 2) * 0.015;
      const my = (mouseRef.current.y - h / 2) * 0.015;

      for (const p of particlesRef.current) {
        p.x += p.vx + mx * 0.3;
        p.y += p.vy + my * 0.3;
        p.phase += p.phaseSpeed;
        p.rotation += p.rotationSpeed;

        // Wrap
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        drawParticle(p, w, h);
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
    };
  }, [initParticles]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ opacity: dark ? 0.7 : 0.5 }}
      aria-hidden
    />
  );
}

/**
 * Burst de confettis — particules colorées qui explosent depuis un point.
 * Usage : <ConfettiBurst trigger={show} /> — rend null après l'animation.
 */
interface ConfettiPiece {
  x: number; y: number; vx: number; vy: number;
  w: number; h: number; color: string;
  rotation: number; rotationSpeed: number;
  life: number;
}

const CONFETTI_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export function ConfettiBurst({ trigger, duration = 2500 }: { trigger: boolean; duration?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!trigger) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    canvas.width = rect.width;
    canvas.height = rect.height;
    const cx = rect.width / 2;
    const cy = rect.height * 0.4;

    const pieces: ConfettiPiece[] = [];
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const force = 4 + Math.random() * 10;
      pieces.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * force,
        vy: Math.sin(angle) * force - 4,
        w: 4 + Math.random() * 6,
        h: 3 + Math.random() * 4,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        life: 1,
      });
    }

    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = elapsed / duration;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25; // gravité
        p.vx *= 0.985; // friction
        p.vy *= 0.985;
        p.rotation += p.rotationSpeed;
        p.life = 1 - progress;

        if (p.life <= 0) continue;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [trigger, duration]);

  if (!trigger) return null;
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-50" aria-hidden />;
}

/**
 * Sparkline — mini graphique de tendance en SVG pur.
 */
export function Sparkline({ 
  data, 
  width = 120, 
  height = 36, 
  color = '#3b82f6',
  fill = true,
  strokeWidth = 2
}: { 
  data: number[]; 
  width?: number; 
  height?: number; 
  color?: string;
  fill?: boolean;
  strokeWidth?: number;
}) {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => ({
    x: i * step,
    y: height - ((v - min) / range) * (height - 4) - 2,
  }));

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${path} L${width},${height} L0,${height} Z`;
  const gradientId = `spark-${color.replace('#', '')}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {fill && <path d={areaPath} fill={`url(#${gradientId})`} />}
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {/* Point final animé */}
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={strokeWidth + 1} fill={color}>
        <animate attributeName="r" values={`${strokeWidth + 1};${strokeWidth + 3};${strokeWidth + 1}`} dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/**
 * Titre avec reveal caractère par caractère (animation stagger).
 */
export function RevealTitle({ 
  text, 
  className = '', 
  delay = 0,
  as: Tag = 'h1' 
}: { 
  text: string; 
  className?: string; 
  delay?: number;
  as?: 'h1' | 'h2' | 'h3';
}) {
  const chars = text.split('');
  return (
    <Tag className={className} aria-label={text}>
      {chars.map((char, i) => (
        <span
          key={i}
          className="inline-block animate-in fade-in slide-in-from-bottom-3 duration-500"
          style={{ animationDelay: `${delay + i * 25}ms`, animationFillMode: 'both' }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </Tag>
  );
}
