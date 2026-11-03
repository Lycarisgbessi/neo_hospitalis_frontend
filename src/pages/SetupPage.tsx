import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp, ArchitectureMode, ModuleType, HospitalProfile, generateId, hashPassword } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { SuccessCheck } from '../components/SuccessCheck';
import { ParticleCanvas, ConfettiBurst, RevealTitle } from '../components/VisualFX';
import { TiltCard } from '../components/TiltCard';
import {
  ShieldPlus, Building2, Layers, ArrowRight, ArrowLeft, Check,
  HeartPulse, Baby, Users, Store, TestTube, Crosshair, Scissors, Activity,
  UserCog, Eye, EyeOff, Sparkles, MapPin, Phone, CheckCircle2,
} from 'lucide-react';
import { cn } from '../lib/utils';

const MODULES: { id: ModuleType; label: string; desc: string; icon: typeof HeartPulse; tint: string }[] = [
  { id: 'cardiologie', label: 'Cardiologie', desc: 'Consultations et suivi cardiologique', icon: HeartPulse, tint: 'text-rose-600 bg-rose-50' },
  { id: 'gynecologie', label: 'Gynécologie-Obstétrique', desc: 'CPN, accouchements, planification familiale', icon: Baby, tint: 'text-pink-600 bg-pink-50' },
  { id: 'pediatrie', label: 'Pédiatrie', desc: 'Consultations, vaccination, néonatologie', icon: Users, tint: 'text-sky-600 bg-sky-50' },
  { id: 'chirurgie', label: 'Chirurgie', desc: 'Interventions programmées et urgences', icon: Scissors, tint: 'text-amber-600 bg-amber-50' },
  { id: 'pharmacie', label: 'Pharmacie interne', desc: 'Ordonnances, dispensation, stocks', icon: Store, tint: 'text-emerald-600 bg-emerald-50' },
  { id: 'laboratoire', label: 'Laboratoire', desc: 'Biologie et résultats structurés', icon: TestTube, tint: 'text-violet-600 bg-violet-50' },
  { id: 'imagerie', label: 'Imagerie médicale', desc: 'Radio, échographie, scanner', icon: Crosshair, tint: 'text-cyan-600 bg-cyan-50' },
  { id: 'bloc', label: 'Bloc opératoire', desc: 'Planning des salles (avec chirurgie)', icon: Activity, tint: 'text-indigo-600 bg-indigo-50' },
];

const STEPS = ['Accueil', 'Établissement', 'Services', 'Administrateur', 'Récapitulatif'];

// ── Transitions cinématiques (profondeur + glissement) ──
const cinematic = {
  enter: (dir: number) => ({
    x: dir > 0 ? 120 : -120,
    opacity: 0,
    scale: 0.92,
    rotateY: dir > 0 ? 8 : -8,
    filter: 'blur(6px)',
  }),
  center: { x: 0, opacity: 1, scale: 1, rotateY: 0, filter: 'blur(0px)' },
  exit: (dir: number) => ({
    x: dir > 0 ? -120 : 120,
    opacity: 0,
    scale: 0.92,
    rotateY: dir > 0 ? -8 : 8,
    filter: 'blur(6px)',
  }),
};

// ── Anneau de progression SVG ──
function ProgressRing({ step, total }: { step: number; total: number }) {
  const radius = 26;
  const circ = 2 * Math.PI * radius;
  const progress = step / total;
  return (
    <div className="relative w-16 h-16">
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="rgb(226 232 240)" strokeWidth="4" />
        <motion.circle
          cx="32" cy="32" r={radius} fill="none"
          stroke="url(#ringGrad)" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circ}
          animate={{ strokeDashoffset: circ * (1 - progress) }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-bold text-slate-900">{step}</span>
    </div>
  );
}

export default function SetupPage() {
  const { setSetup, setArchitectureMode, activeModules, setActiveModules, registerUser, setHospitalProfile } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(false);
  const [confetti, setConfetti] = useState(false);

  const [mode, setMode] = useState<ArchitectureMode>('clinic');
  const [profile, setProfile] = useState<HospitalProfile>({ name: '', city: 'Conakry', phone: '' });
  const [nameError, setNameError] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPwd, setAdminPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [adminError, setAdminError] = useState('');

  const go = (next: number) => { setDir(next > step ? 1 : -1); setStep(next); };
  const kick = () => { setShake(true); window.setTimeout(() => setShake(false), 500); };

  const validateStep = (): boolean => {
    if (step === 1) {
      if (!profile.name.trim()) { setNameError('Donnez un nom à votre établissement.'); kick(); return false; }
      setNameError('');
    }
    if (step === 3) {
      if (!adminName.trim() || adminPwd.length < 4) { setAdminError('Nom complet + mot de passe (4 caractères min.) requis.'); kick(); return false; }
      setAdminError('');
    }
    return true;
  };

  const next = () => { if (validateStep()) go(Math.min(step + 1, 4)); };
  const back = () => go(Math.max(step - 1, 0));
  const toggleModule = (id: ModuleType) => setActiveModules({ ...activeModules, [id]: !activeModules[id] });

  const setModulesPreset = (preset: 'essentiel' | 'tout') => {
    setActiveModules({
      cardiologie: preset === 'tout', gynecologie: true, pediatrie: true,
      chirurgie: preset === 'tout', pharmacie: true, laboratoire: true,
      imagerie: true, bloc: preset === 'tout',
    });
  };

  const launch = () => {
    setHospitalProfile({ name: profile.name.trim(), city: profile.city.trim() || 'Conakry', phone: profile.phone.trim() });
    setArchitectureMode(mode);
    registerUser({
      id: generateId('USR'), name: adminName.trim(), volet: 'administration',
      role: 'super_admin', passwordHash: hashPassword(adminPwd), createdAt: new Date().toISOString(),
    });
    setSetup(true);
    setConfetti(true);
    setDone(true);
    window.setTimeout(() => navigate('/'), 2600);
  };

  const canContinue = step !== 1 || profile.name.trim().length > 0;

  return (
    <div className="min-h-screen bg-mesh flex flex-col relative overflow-hidden">
      {/* Particules médicales en fond */}
      <ParticleCanvas density={30} speed={0.35} />
      <ConfettiBurst trigger={confetti} duration={2200} />

      {/* Orbes d'ambiance */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-[30rem] h-[30rem] rounded-full bg-gradient-to-br from-blue-500/12 to-violet-500/8 blur-3xl animate-float-y" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 w-[36rem] h-[36rem] rounded-full bg-gradient-to-br from-violet-500/10 to-cyan-500/6 blur-3xl animate-float-y" style={{ animationDelay: '1.5s' }} />
      <div className="pointer-events-none absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-cyan-400/6 blur-3xl animate-float-y" style={{ animationDelay: '0.8s' }} />

      {/* ── Barre de progression (anneau + étapes) ── */}
      {step > 0 && !done && (
        <motion.div
          initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="sticky top-0 z-20 glass border-b border-white/50"
        >
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-5">
            <ProgressRing step={step} total={4} />
            <div className="flex-1 flex items-center gap-1">
              {STEPS.slice(1).map((label, i) => {
                const idx = i + 1;
                const state = step === idx ? 'current' : step > idx ? 'done' : 'todo';
                return (
                  <React.Fragment key={label}>
                    {i > 0 && <motion.div
                      className="flex-1 h-[3px] rounded-full origin-left"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: step > idx ? 1 : 0 }}
                      transition={{ duration: 0.4, delay: i * 0.08 }}
                      style={{ background: step > idx ? 'linear-gradient(90deg,#3b82f6,#8b5cf6)' : '#e2e8f0' }}
                    />}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <motion.div
                        animate={{
                          scale: state === 'current' ? 1.15 : 1,
                          backgroundColor: state === 'todo' ? '#e2e8f0' : '#3b82f6',
                        }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        className="w-8 h-8 rounded-2xl grid place-items-center text-xs font-bold shadow-sm"
                        style={{ color: state === 'todo' ? '#94a3b8' : '#fff' }}
                      >
                        {state === 'done' ? <Check className="w-4 h-4" /> : idx}
                      </motion.div>
                      <span className={cn(
                        'text-[10px] font-semibold tracking-wide transition-colors',
                        state === 'current' ? 'text-slate-900' : state === 'done' ? 'text-blue-600' : 'text-slate-400'
                      )}>{label}</span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <AnimatePresence mode="wait" custom={dir}>
          {done ? (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }} className="text-center space-y-6 py-16">
              <SuccessCheck size={110} />
              <RevealTitle text={`${profile.name} est prêt`} className="text-3xl font-bold tracking-tight text-slate-900" delay={200} as="h2" />
              <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 600 }} className="text-slate-500 flex items-center justify-center gap-2 text-lg">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Redirection vers votre tableau de bord…
              </motion.p>
            </motion.div>
          ) : step === 0 ? (
            /* ══ ÉTAPE 0 : ACCUEIL CINÉMATIQUE ══ */
            <motion.div key="s0" variants={cinematic} custom={dir} initial="enter" animate="center" exit="exit" transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} className="max-w-3xl text-center space-y-12 py-8">
              {/* Logo avec anneaux concentriques */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.1 }}
                className="relative w-32 h-32 mx-auto"
              >
                <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 shadow-[0_20px_60px_-15px_rgba(59,130,246,0.5)] grid place-items-center">
                  <ShieldPlus className="w-14 h-14 text-white drop-shadow-lg" />
                </div>
                {/* Anneaux orbitaux */}
                <motion.div className="absolute -inset-4 rounded-[2.5rem] border-2 border-blue-500/25" animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}>
                  <span className="absolute top-1/2 -right-1.5 w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]" />
                </motion.div>
                <motion.div className="absolute -inset-8 rounded-[3rem] border border-violet-500/15" animate={{ rotate: -360 }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}>
                  <span className="absolute top-0 left-1/2 w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
                </motion.div>
              </motion.div>

              {/* Titre révélé caractère par caractère */}
              <div>
                <RevealTitle text="Votre hôpital," className="text-5xl sm:text-6xl font-bold tracking-tighter text-slate-900" delay={300} />
                <RevealTitle text="orchestré." className="text-5xl sm:text-6xl font-bold tracking-tighter bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent pb-2" delay={700} />
              </div>

              <motion.p
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1000 }}
                className="text-lg text-slate-500 max-w-xl mx-auto leading-relaxed"
              >
                Admissions, caisse, consultations avec dictée vocale IA,
                laboratoire, imagerie, pharmacie et comptabilité — pensé pour les cliniques africaines.
              </motion.p>

              {/* Cartes atouts en tilt 3D */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                {[
                  { icon: Users, label: 'Parcours patient', delay: 1100 },
                  { icon: Sparkles, label: 'Dictée IA', delay: 1200 },
                  { icon: Building2, label: 'Multi-services', delay: 1300 },
                  { icon: Activity, label: 'Temps réel', delay: 1400 },
                ].map(({ icon: Icon, label, delay: d }) => (
                  <motion.div key={label} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: d, duration: 0.5 }}>
                    <TiltCard maxTilt={10} scale={1.04}>
                      <div className="glass rounded-2xl px-4 py-5 flex flex-col items-center gap-2.5 shadow-soft hover:shadow-lift transition-shadow duration-300">
                        <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/15 to-violet-600/15 grid place-items-center">
                          <Icon className="w-5 h-5 text-blue-600" />
                        </span>
                        <span className="text-xs font-semibold text-slate-700">{label}</span>
                      </div>
                    </TiltCard>
                  </motion.div>
                ))}
              </div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1500 }} className="flex flex-col items-center gap-4">
                <Button size="lg" onClick={() => go(1)} className="btn-sheen rounded-2xl px-12 h-14 text-base font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:brightness-115 shadow-[0_12px_40px_-8px_rgba(59,130,246,0.5)] group">
                  Configurer mon établissement
                  <ArrowRight className="w-5 h-5 ml-2.5 group-hover:translate-x-1.5 transition-transform duration-300" />
                </Button>
                <p className="text-micro flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  2 minutes · aucune donnée ne quitte ce navigateur
                </p>
              </motion.div>
            </motion.div>
          ) : (
            /* ══ ÉTAPES 1→4 ══ */
            <motion.div
              key={`s${step}`}
              variants={cinematic} custom={dir} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className={cn('w-full max-w-4xl bg-white/85 backdrop-blur-xl rounded-[2rem] shadow-[0_24px_80px_-24px_rgba(15,23,42,0.25),0_2px_8px_rgba(15,23,42,0.06)] border border-white/70 p-8 sm:p-12', shake && 'animate-shake')}
            >
              {/* ÉTAPE 1 */}
              {step === 1 && (
                <div className="space-y-8">
                  <header className="space-y-1.5">
                    <p className="text-micro">Étape 1 · Type d'établissement</p>
                    <RevealTitle text="Quel est votre modèle ?" className="text-3xl font-bold tracking-tight text-slate-900" delay={100} as="h2" />
                    <p className="text-sm text-slate-500">Ce choix définit la circulation des patients entre les services.</p>
                  </header>

                  <div className="grid sm:grid-cols-2 gap-5">
                    {([
                      { id: 'clinic', icon: Building2, title: 'Clinique', desc: 'Parcours unifié — médecins polyvalents, salle commune.', meta: 'Petites et moyennes structures' },
                      { id: 'polyclinic', icon: Layers, title: 'Polyclinique', desc: 'Services cloisonnés — chaque spécialité a ses patients et son personnel.', meta: 'Structures multi-spécialités' },
                    ] as const).map(({ id, icon: Icon, title, desc, meta }) => (
                      <TiltCard key={id} maxTilt={5} scale={1.01}>
                        <button
                          type="button"
                          onClick={() => setMode(id)}
                          className={cn(
                            'w-full relative text-left p-6 rounded-3xl border-2 transition-all duration-300',
                            mode === id ? 'border-transparent card-active-glow bg-gradient-to-br from-blue-50/80 to-indigo-50/40' : 'border-slate-200/70 hover:border-blue-300/60 hover:shadow-soft bg-white/60',
                          )}
                        >
                          <span className={cn(
                            'w-12 h-12 rounded-2xl grid place-items-center mb-4 transition-all duration-300',
                            mode === id ? 'bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-glow-blue scale-110' : 'bg-slate-100 text-slate-500',
                          )}>
                            <Icon className="w-6 h-6" />
                          </span>
                          <h3 className="font-bold text-slate-900 text-lg">{title}</h3>
                          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{desc}</p>
                          <p className="text-micro mt-3">{meta}</p>
                          <motion.span
                            animate={{ scale: mode === id ? 1 : 0.5, opacity: mode === id ? 1 : 0 }}
                            className="absolute top-5 right-5 w-6 h-6 rounded-full bg-blue-600 grid place-items-center"
                          >
                            <Check className="w-3.5 h-3.5 text-white" />
                          </motion.span>
                        </button>
                      </TiltCard>
                    ))}
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200/50">
                    <div>
                      <label className="text-micro block mb-1.5">Nom de l'établissement *</label>
                      <Input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} placeholder="Ex : Clinique Espoir" className="h-11 rounded-xl" autoFocus />
                      {nameError && <p className="text-xs text-red-600 mt-1.5">{nameError}</p>}
                    </div>
                    <div>
                      <label className="text-micro block mb-1.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> Ville</label>
                      <Input value={profile.city} onChange={e => setProfile({ ...profile, city: e.target.value })} placeholder="Conakry" className="h-11 rounded-xl" />
                    </div>
                    <div>
                      <label className="text-micro block mb-1.5 flex items-center gap-1"><Phone className="w-3 h-3" /> Téléphone</label>
                      <Input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="+224 …" className="h-11 rounded-xl" />
                    </div>
                  </div>
                </div>
              )}

              {/* ÉTAPE 2 */}
              {step === 2 && (
                <div className="space-y-7">
                  <header>
                    <p className="text-micro">Étape 2 · Services & modules</p>
                    <RevealTitle text="Composez votre plateau" className="text-3xl font-bold tracking-tight text-slate-900" delay={100} as="h2" />
                    <p className="text-sm text-slate-500 mt-1">Activez uniquement les services que vous proposez.</p>
                  </header>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setModulesPreset('essentiel')} className="rounded-full text-xs">L'essentiel</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setModulesPreset('tout')} className="rounded-full text-xs">Tout activer</Button>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {MODULES.map(({ id, label, desc, icon: Icon, tint }, i) => {
                      const on = activeModules[id];
                      return (
                        <motion.button
                          key={id}
                          type="button"
                          onClick={() => toggleModule(id)}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 60, duration: 0.35 }}
                          whileHover={{ y: -4, scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          className={cn(
                            'relative flex flex-col items-start gap-2.5 p-4 rounded-2xl border-2 text-left transition-colors',
                            on ? 'border-blue-500/60 bg-gradient-to-br from-blue-50/60 to-white shadow-soft' : 'border-slate-200/60 hover:border-blue-300/50 bg-white/60',
                          )}
                        >
                          <span className={cn('w-10 h-10 rounded-xl grid place-items-center', tint, on && 'ring-2 ring-blue-500/20')}>
                            <Icon className="w-5 h-5" />
                          </span>
                          <span className="font-semibold text-slate-900 text-[13px] leading-tight">{label}</span>
                          <span className="text-[11px] text-slate-500 leading-snug">{desc}</span>
                          <motion.span
                            animate={{ scale: on ? 1 : 0, rotate: on ? 0 : -90 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                            className="absolute top-3 right-3 w-5 h-5 rounded-lg bg-blue-600 grid place-items-center"
                          >
                            <Check className="w-3 h-3 text-white" />
                          </motion.span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ÉTAPE 3 */}
              {step === 3 && (
                <div className="space-y-8">
                  <header>
                    <p className="text-micro">Étape 3 · Compte administrateur</p>
                    <RevealTitle text="Qui pilera l'établissement ?" className="text-3xl font-bold tracking-tight text-slate-900" delay={100} as="h2" />
                    <p className="text-sm text-slate-500 mt-1">Ce compte accède à tous les écrans, budgets et paramètres.</p>
                  </header>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 200 }}
                    className="flex items-center gap-5 p-5 bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-3xl border border-slate-100"
                  >
                    <motion.div
                      animate={{ rotate: [0, -3, 3, 0] }}
                      transition={{ duration: 4, repeat: Infinity }}
                      className="w-16 h-16 rounded-[1.25rem] bg-gradient-to-br from-blue-600 to-violet-600 text-white grid place-items-center text-2xl font-bold shadow-[0_10px_30px_-8px_rgba(59,130,246,0.5)]"
                    >
                      {(adminName.trim().charAt(0) || <UserCog className="w-7 h-7" />) as React.ReactNode}
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-lg truncate">{adminName.trim() || 'Votre nom complet'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-100/80 text-blue-700 text-[11px] font-bold uppercase tracking-wider">Super Administrateur</span>
                        <span className="text-xs text-slate-400">accès complet</span>
                      </div>
                    </div>
                  </motion.div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-micro block mb-1.5">Nom complet *</label>
                      <Input value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Ex : Dr Awa Camara" className="h-11 rounded-xl" autoFocus />
                    </div>
                    <div>
                      <label className="text-micro block mb-1.5">Mot de passe *</label>
                      <div className="relative">
                        <Input type={showPwd ? 'text' : 'password'} value={adminPwd} onChange={e => setAdminPwd(e.target.value)} placeholder="4 caractères minimum" className="h-11 rounded-xl pr-11" />
                        <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors">
                          {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  {adminError && <p className="text-xs text-red-600">{adminError}</p>}
                  <p className="text-xs text-slate-400">Astuce : les comptes du personnel se créeront depuis l'écran de connexion.</p>
                </div>
              )}

              {/* ÉTAPE 4 */}
              {step === 4 && (
                <div className="space-y-7">
                  <header>
                    <p className="text-micro">Dernière étape · Vérification</p>
                    <RevealTitle text="Tout est bon ?" className="text-3xl font-bold tracking-tight text-slate-900" delay={100} as="h2" />
                  </header>
                  <div className="space-y-3">
                    {[
                      { icon: Building2, label: 'Établissement', value: `${profile.name} — ${profile.city}`, delay: 0 },
                      { icon: mode === 'clinic' ? Building2 : Layers, label: 'Architecture', value: mode === 'clinic' ? 'Clinique (parcours unifié)' : 'Polyclinique (services cloisonnés)', delay: 80 },
                      { icon: Activity, label: 'Services actifs', value: `${Object.values(activeModules).filter(Boolean).length} module(s)`, delay: 160 },
                      { icon: UserCog, label: 'Administrateur', value: adminName, delay: 240 },
                    ].map(({ icon: Icon, label, value, delay: d }) => (
                      <motion.div
                        key={label}
                        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: d }}
                        className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50/60 border border-slate-100 hover:border-blue-200/60 hover:bg-blue-50/30 transition-all duration-300"
                      >
                        <span className="w-10 h-10 rounded-xl bg-white grid place-items-center text-blue-600 shadow-soft shrink-0"><Icon className="w-5 h-5" /></span>
                        <div className="min-w-0">
                          <p className="text-micro">{label}</p>
                          <p className="text-sm font-semibold text-slate-800 mt-0.5">{value}</p>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 ml-auto shrink-0 mt-1" />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between gap-4 mt-10 pt-7 border-t border-slate-200/50">
                <Button type="button" variant="ghost" onClick={back} className="rounded-xl">
                  <ArrowLeft className="w-4 h-4 mr-1.5" /> Retour
                </Button>
                {step < 4 ? (
                  <Button type="button" onClick={next} disabled={!canContinue} className="btn-sheen rounded-xl px-8 h-11 font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 shadow-[0_8px_25px_-6px_rgba(59,130,246,0.4)]">
                    Continuer <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                ) : (
                  <Button type="button" onClick={launch} className="btn-sheen rounded-xl px-8 h-11 font-bold bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:brightness-110 shadow-[0_10px_35px_-8px_rgba(16,185,129,0.45)] text-base">
                    <Sparkles className="w-4.5 h-4.5 mr-2" /> Lancer Hospitalis
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="relative z-10 pb-6 text-center text-micro">Hospitalis · configuration locale sécurisée</footer>
    </div>
  );
}
