import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp, ArchitectureMode, ModuleType, HospitalProfile, generateId, hashPassword } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { SuccessCheck } from '../components/SuccessCheck';
import {
  ShieldPlus, Building2, Layers, ArrowRight, ArrowLeft, Check,
  HeartPulse, Baby, Users, Store, TestTube, Crosshair, Scissors, Activity,
  UserCog, Eye, EyeOff, Sparkles, MapPin, Phone, Hotel, CheckCircle2,
} from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * Configuration initiale — wizard immersif en 5 étapes (refonte DA) :
 * 0. Accueil animé (branding, promesse)
 * 1. L'établissement (type + identité : nom, ville, téléphone)
 * 2. Services & modules (cartes riches + activations rapides)
 * 3. Compte administrateur (super-admin créé ici — plus de devinette à la connexion)
 * 4. Récapitulatif + lancement (succès animé, connexion automatique)
 */

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

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 56 : -56, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -56 : 56, opacity: 0 }),
};

export default function SetupPage() {
  const { setSetup, setArchitectureMode, activeModules, setActiveModules, registerUser, setHospitalProfile } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(false);

  // Étape 1 — établissement
  const [mode, setMode] = useState<ArchitectureMode>('clinic');
  const [profile, setProfile] = useState<HospitalProfile>({ name: '', city: 'Conakry', phone: '' });
  const [nameError, setNameError] = useState('');

  // Étape 3 — administrateur
  const [adminName, setAdminName] = useState('');
  const [adminPwd, setAdminPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [adminError, setAdminError] = useState('');

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const kick = () => {
    setShake(true);
    window.setTimeout(() => setShake(false), 500);
  };

  const validateStep = (): boolean => {
    if (step === 1) {
      if (!profile.name.trim()) { setNameError('Donnez un nom à votre établissement.'); kick(); return false; }
      setNameError('');
    }
    if (step === 3) {
      if (!adminName.trim() || adminPwd.length < 4) {
        setAdminError('Nom complet + mot de passe (4 caractères min.) requis.');
        kick();
        return false;
      }
      setAdminError('');
    }
    return true;
  };

  const next = () => { if (validateStep()) go(Math.min(step + 1, 4)); };
  const back = () => go(Math.max(step - 1, 0));

  const toggleModule = (id: ModuleType) =>
    setActiveModules({ ...activeModules, [id]: !activeModules[id] });

  const setModulesPreset = (preset: 'essentiel' | 'tout') => {
    const base: Record<ModuleType, boolean> = {
      cardiologie: preset === 'tout',
      gynecologie: true,
      pediatrie: true,
      chirurgie: preset === 'tout',
      pharmacie: true,
      laboratoire: true,
      imagerie: true,
      bloc: preset === 'tout',
    };
    setActiveModules(base);
  };

  const launch = () => {
    setHospitalProfile({
      name: profile.name.trim(),
      city: profile.city.trim() || 'Conakry',
      phone: profile.phone.trim(),
    });
    setArchitectureMode(mode);
    registerUser({
      id: generateId('USR'),
      name: adminName.trim(),
      volet: 'administration',
      role: 'super_admin',
      passwordHash: hashPassword(adminPwd),
      createdAt: new Date().toISOString(),
    });
    setSetup(true);
    setDone(true);
    window.setTimeout(() => navigate('/'), 1900);
  };

  const canContinue = step !== 1 || profile.name.trim().length > 0;

  return (
    <div className="min-h-screen bg-mesh flex flex-col relative overflow-hidden">
      {/* Orbes d'ambiance */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-400/10 blur-3xl animate-float-y" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 w-[28rem] h-[28rem] rounded-full bg-violet-400/10 blur-3xl animate-float-y" style={{ animationDelay: '1.2s' }} />

      {/* ── Barre de progression ── */}
      {step > 0 && !done && (
        <div className="sticky top-0 z-20 glass border-b border-white/60">
          <div className="max-w-3xl mx-auto px-6 py-3.5 flex items-center gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <ShieldPlus className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-slate-900 tracking-tight hidden sm:block">Hospitalis</span>
            </div>
            <div className="flex-1 flex items-center">
              {STEPS.slice(1).map((label, i) => {
                const idx = i + 1;
                const state = step === idx ? 'current' : step > idx ? 'done' : 'todo';
                return (
                  <React.Fragment key={label}>
                    {i > 0 && <div className={cn('flex-1 h-0.5 rounded-full transition-colors duration-500', state === 'todo' ? 'bg-slate-200' : 'bg-blue-600')} />}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className={cn(
                        'w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold transition-all duration-300',
                        state === 'done' && 'bg-blue-600 text-white',
                        state === 'current' && 'bg-blue-600 text-white ring-4 ring-blue-600/20 scale-110',
                        state === 'todo' && 'bg-slate-200 text-slate-500',
                      )}>
                        {state === 'done' ? <Check className="w-3.5 h-3.5" /> : idx}
                      </div>
                      <span className={cn('text-xs font-semibold hidden md:block', state === 'current' ? 'text-slate-900' : 'text-slate-400')}>{label}</span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
            <span className="text-micro shrink-0">{step}/4</span>
          </div>
        </div>
      )}

      {/* ── Contenu ── */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <AnimatePresence mode="wait" custom={dir}>
          {done ? (
            /* Écran de succès */
            <motion.div key="done" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-5 py-16">
              <SuccessCheck size={96} />
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">{profile.name} est prêt</h2>
                <p className="text-slate-500 mt-2 flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Bienvenue sur Hospitalis — redirection vers votre tableau de bord…
                </p>
              </div>
            </motion.div>
          ) : step === 0 ? (
            /* ── ÉTAPE 0 : ACCUEIL ── */
            <motion.div key="s0" variants={slideVariants} custom={dir} initial="enter" animate="center" exit="exit" transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }} className="max-w-2xl text-center space-y-10 py-10">
              <div className="space-y-6 animate-in fade-in duration-700">
                <div className="relative w-24 h-24 mx-auto pulse-ring rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-glow-blue grid place-items-center">
                  <ShieldPlus className="w-11 h-11 text-white" />
                </div>
                <div className="space-y-3">
                  <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
                    Votre hôpital,
                    <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent"> orchestré</span>
                  </h1>
                  <p className="text-lg text-slate-500 max-w-xl mx-auto leading-relaxed">
                    Admissions, caisse, consultations avec dictée vocale IA, laboratoire, imagerie,
                    pharmacie et comptabilité — un parcours complet, pensé pour les cliniques africaines.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                {[
                  { icon: Users, label: 'Parcours patient' },
                  { icon: Sparkles, label: 'Dictée IA' },
                  { icon: Building2, label: 'Multi-services' },
                  { icon: Activity, label: 'Temps réel' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="glass rounded-2xl px-4 py-4 flex flex-col items-center gap-2 shadow-soft hover:shadow-lift hover:-translate-y-1 transition-all duration-300">
                    <Icon className="w-5 h-5 text-blue-600" />
                    <span className="text-xs font-semibold text-slate-600">{label}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col items-center gap-3 animate-in fade-in duration-700 delay-300">
                <Button size="lg" onClick={() => go(1)} className="btn-sheen rounded-xl px-10 h-12 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 shadow-glow-blue">
                  Configurer mon établissement
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-0.5 transition-transform" />
                </Button>
                <p className="text-micro flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 2 minutes · aucune donnée ne quitte ce navigateur</p>
              </div>
            </motion.div>
          ) : (
            /* ── ÉTAPES 1→4 ── */
            <motion.div
              key={`s${step}`}
              variants={slideVariants} custom={dir} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className={cn('w-full max-w-3xl bg-white rounded-3xl shadow-lift border border-slate-200/70 p-8 sm:p-10', shake && 'animate-shake')}
            >
              {/* ÉTAPE 1 : ÉTABLISSEMENT */}
              {step === 1 && (
                <div className="space-y-8">
                  <header className="space-y-1.5">
                    <p className="text-micro">Étape 1 · Type d'établissement</p>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Quel est votre modèle d'organisation ?</h2>
                    <p className="text-sm text-slate-500">Ce choix définit la circulation des patients entre les services.</p>
                  </header>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {([
                      { id: 'clinic', icon: Building2, title: 'Clinique', desc: 'Parcours unifié — médecins polyvalents, salle commune, équipe soudée.', meta: 'Petites et moyennes structures' },
                      { id: 'polyclinic', icon: Layers, title: 'Polyclinique', desc: 'Services cloisonnés — chaque spécialité a ses patients et son personnel.', meta: 'Structures multi-spécialités' },
                    ] as const).map(({ id, icon: Icon, title, desc, meta }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setMode(id)}
                        className={cn(
                          'relative text-left p-5 rounded-2xl border-2 transition-all duration-300 group',
                          mode === id
                            ? 'border-blue-600 bg-blue-50/60 card-active-glow'
                            : 'border-slate-200 hover:border-blue-300 hover:shadow-soft',
                        )}
                      >
                        <Icon className={cn('w-7 h-7 mb-3 transition-transform duration-300 group-hover:scale-110', mode === id ? 'text-blue-600' : 'text-slate-400')} />
                        <h3 className="font-bold text-slate-900">{title}</h3>
                        <p className="text-sm text-slate-500 mt-1 leading-relaxed">{desc}</p>
                        <p className="text-micro mt-3">{meta}</p>
                        <span className={cn(
                          'absolute top-4 right-4 w-5 h-5 rounded-full grid place-items-center transition-all duration-300',
                          mode === id ? 'bg-blue-600 scale-100' : 'bg-slate-200 scale-75',
                        )}>
                          <Check className="w-3 h-3 text-white" />
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                    <div className="sm:col-span-1">
                      <label className="text-micro block mb-1.5">Nom de l'établissement *</label>
                      <Input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} placeholder="Ex : Clinique Espoir" className="h-11" autoFocus />
                      {nameError && <p className="text-xs text-red-600 mt-1.5">{nameError}</p>}
                    </div>
                    <div>
                      <label className="text-micro block mb-1.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> Ville</label>
                      <Input value={profile.city} onChange={e => setProfile({ ...profile, city: e.target.value })} placeholder="Conakry" className="h-11" />
                    </div>
                    <div>
                      <label className="text-micro block mb-1.5 flex items-center gap-1"><Phone className="w-3 h-3" /> Téléphone</label>
                      <Input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="+224 …" className="h-11" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5"><Hotel className="w-3.5 h-3.5" /> Ces informations apparaissent sur les reçus et ordonnances.</p>
                </div>
              )}

              {/* ÉTAPE 2 : SERVICES */}
              {step === 2 && (
                <div className="space-y-7">
                  <header className="space-y-1.5">
                    <p className="text-micro">Étape 2 · Services & modules</p>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Composez votre plateau technique</h2>
                    <p className="text-sm text-slate-500">Activez uniquement les services que vous proposez — les rôles et écrans s'adaptent.</p>
                  </header>

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setModulesPreset('essentiel')} className="rounded-full">L'essentiel</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setModulesPreset('tout')} className="rounded-full">Tout activer</Button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    {MODULES.map(({ id, label, desc, icon: Icon, tint }) => {
                      const on = activeModules[id];
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleModule(id)}
                          className={cn(
                            'flex items-start gap-3.5 p-4 rounded-2xl border-2 text-left transition-all duration-300 group',
                            on ? 'border-blue-600/70 bg-blue-50/50 shadow-soft' : 'border-slate-200 hover:border-blue-300 hover:shadow-soft',
                          )}
                        >
                          <span className={cn('w-10 h-10 rounded-xl grid place-items-center shrink-0 transition-transform duration-300 group-hover:scale-110', tint, on && 'ring-1 ring-blue-600/30')}>
                            <Icon className="w-5 h-5" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="font-semibold text-slate-900 text-sm block">{label}</span>
                            <span className="text-xs text-slate-500 block mt-0.5 leading-relaxed">{desc}</span>
                          </span>
                          <span className={cn(
                            'w-5 h-5 rounded-md grid place-items-center border-2 transition-all duration-200 shrink-0 mt-0.5',
                            on ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white',
                          )}>
                            {on && <Check className="w-3 h-3 text-white" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ÉTAPE 3 : ADMINISTRATEUR */}
              {step === 3 && (
                <div className="space-y-8">
                  <header className="space-y-1.5">
                    <p className="text-micro">Étape 3 · Compte administrateur</p>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Qui pilera l'établissement ?</h2>
                    <p className="text-sm text-slate-500">Ce compte « Super Administrateur » accède à tous les écrans, budgets et paramètres.</p>
                  </header>

                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white grid place-items-center text-xl font-bold shadow-glow-blue">
                      {(adminName.trim().charAt(0) || <UserCog className="w-6 h-6" />) as React.ReactNode}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{adminName.trim() || 'Votre nom complet'}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">SUPER ADMINISTRATEUR</span>
                        <span className="hidden sm:inline">· accès complet</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-micro block mb-1.5">Nom complet *</label>
                      <Input value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Ex : Dr Awa Camara" className="h-11" autoFocus />
                    </div>
                    <div>
                      <label className="text-micro block mb-1.5">Mot de passe *</label>
                      <div className="relative">
                        <Input
                          type={showPwd ? 'text' : 'password'}
                          value={adminPwd}
                          onChange={e => setAdminPwd(e.target.value)}
                          placeholder="4 caractères minimum"
                          className="h-11 pr-11"
                        />
                        <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors" aria-label={showPwd ? 'Masquer' : 'Afficher'}>
                          {showPwd ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  {adminError && <p className="text-xs text-red-600">{adminError}</p>}
                  <p className="text-xs text-slate-400">Astuce : les comptes du personnel (médecins, caissiers…) se créeront ensuite depuis l'écran de connexion — un par rôle.</p>
                </div>
              )}

              {/* ÉTAPE 4 : RÉCAP */}
              {step === 4 && (
                <div className="space-y-7">
                  <header className="space-y-1.5">
                    <p className="text-micro">Dernière étape · Vérification</p>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Tout est bon ?</h2>
                  </header>

                  <div className="space-y-3">
                    {[
                      { icon: Building2, label: 'Établissement', value: `${profile.name} — ${profile.city}${profile.phone ? ` · ${profile.phone}` : ''}` },
                      { icon: mode === 'clinic' ? Building2 : Layers, label: 'Architecture', value: mode === 'clinic' ? 'Clinique (parcours unifié)' : 'Polyclinique (services cloisonnés)' },
                      { icon: Activity, label: 'Services actifs', value: `${Object.values(activeModules).filter(Boolean).length} module(s) : ${MODULES.filter(m => activeModules[m.id]).map(m => m.label).join(', ') || 'aucun'}` },
                      { icon: UserCog, label: 'Administrateur', value: `${adminName} (super administrateur)` },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-colors duration-300">
                        <span className="w-9 h-9 rounded-xl bg-white grid place-items-center text-blue-600 shadow-soft shrink-0"><Icon className="w-4.5 h-4.5" /></span>
                        <div className="min-w-0">
                          <p className="text-micro">{label}</p>
                          <p className="text-sm font-medium text-slate-800 mt-0.5 break-words">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between gap-4 mt-9 pt-6 border-t border-slate-100">
                <Button type="button" variant="ghost" onClick={back} className="rounded-xl">
                  <ArrowLeft className="w-4 h-4 mr-1.5" /> Retour
                </Button>
                {step < 4 ? (
                  <Button type="button" onClick={next} disabled={!canContinue} className="btn-sheen rounded-xl px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 shadow-glow-blue">
                    Continuer <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                ) : (
                  <Button type="button" onClick={launch} className="btn-sheen rounded-xl px-8 h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 shadow-lg shadow-emerald-600/30">
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
