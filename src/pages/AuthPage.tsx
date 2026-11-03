import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp, UserRole, generateId, hashPassword } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import {
  ShieldPlus, Stethoscope, Syringe, Pill, TestTube, Crosshair, Baby, Users, Banknote,
  Calculator, ShieldCheck, TrendingUp, Eye, EyeOff, ArrowLeftRight, Lock, UserPlus, LogIn, AlertCircle, MapPin, Activity,
} from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * Écran de connexion / inscription — refonte DA (split-screen immersif) :
 *  - Panneau branding (dégradé-mesh sombre, atouts produit)
 *  - Connexion d'abord (nom + mot de passe, détection de compte existant)
 *  - Inscription : rôles en CARTES VISUELLES regroupées Médical/Administratif
 *    (fini le pré-choix « volet »), service demandé uniquement pour les médecins
 *    en polyclinique.
 */

type Mode = 'login' | 'register';

const MEDICAL_ROLES: { id: UserRole; label: string; desc: string; icon: typeof Stethoscope; module?: 'pharmacie' | 'laboratoire' | 'imagerie' | 'gynecologie' }[] = [
  { id: 'medecin', label: 'Médecin', desc: 'Consultations, ordonnances, dictée IA', icon: Stethoscope },
  { id: 'infirmier', label: 'Infirmier / ère', desc: 'Soins et pansements', icon: Syringe },
  { id: 'sage_femme', label: 'Sage-femme', desc: 'Maternité et suivi CPN', icon: Baby, module: 'gynecologie' },
  { id: 'pharmacien', label: 'Pharmacien', desc: 'Dispensation et stocks', icon: Pill, module: 'pharmacie' },
  { id: 'technicien_labo', label: 'Technicien Laboratoire', desc: 'Analyses et résultats', icon: TestTube, module: 'laboratoire' },
  { id: 'technicien_imagerie', label: 'Technicien Imagerie', desc: 'Radio, écho, scanner', icon: Crosshair, module: 'imagerie' },
];

const ADMIN_ROLES: { id: UserRole; label: string; desc: string; icon: typeof Users }[] = [
  { id: 'receptionniste', label: 'Réceptionniste', desc: 'Admissions et triages', icon: Users },
  { id: 'caissier', label: 'Caissier', desc: 'Encaissements et assurances', icon: Banknote },
  { id: 'comptable', label: 'Comptable', desc: 'Recettes, budgets, validations', icon: Calculator },
  { id: 'directeur_financier', label: 'Directeur financier', desc: 'Pilotage et trésorerie', icon: TrendingUp },
  { id: 'super_admin', label: 'Super Administrateur', desc: 'Accès complet au système', icon: ShieldCheck },
];

export default function AuthPage() {
  const { registerUser, login, findUserByName, architectureMode, activeModules, hospitalProfile } = useApp();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [service, setService] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const existing = useMemo(() => (name.trim() ? findUserByName(name) : undefined), [name, findUserByName]);
  const needsService = mode === 'register' && role === 'medecin' && architectureMode === 'polyclinic';

  const availableMedical = MEDICAL_ROLES.filter(r => !r.module || activeModules[r.module]);
  const services = [
    ...(activeModules.cardiologie ? [{ id: 'cardiologie', label: 'Cardiologie' }] : []),
    ...(activeModules.gynecologie ? [{ id: 'gynecologie', label: 'Gynécologie-Obstétrique' }] : []),
    ...(activeModules.pediatrie ? [{ id: 'pediatrie', label: 'Pédiatrie' }] : []),
    ...(activeModules.chirurgie ? [{ id: 'chirurgie', label: 'Chirurgie' }] : []),
    { id: 'general', label: 'Médecine Générale' },
  ];

  const kick = () => { setShake(true); window.setTimeout(() => setShake(false), 500); };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    if (m === 'login') { setRole(null); setService(''); }
  };

  const handleSubmit = () => {
    setError('');

    if (!name.trim() || !password) { setError('Renseignez votre nom et votre mot de passe.'); kick(); return; }

    if (mode === 'login') {
      const user = findUserByName(name);
      if (!user) { setError('Aucun compte à ce nom. Basculez sur « Créer un compte » pour l\'enregistrer.'); kick(); return; }
      if (user.passwordHash !== hashPassword(password)) { setError('Mot de passe incorrect.'); kick(); return; }
      login(user);
      navigate('/');
      return;
    }

    // Inscription
    if (existing) { setError(`« ${existing.name} » possède déjà un compte — connectez-vous.`); kick(); return; }
    if (!role) { setError('Choisissez votre rôle dans l\'équipe.'); kick(); return; }
    if (password.length < 4) { setError('Mot de passe : 4 caractères minimum.'); kick(); return; }
    if (needsService && !service) { setError('Choisissez votre service d\'affectation.'); kick(); return; }

    registerUser({
      id: generateId('USR'),
      name: name.trim(),
      volet: MEDICAL_ROLES.some(r => r.id === role) ? 'medical' : 'administratif',
      role,
      service: needsService ? service : undefined,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    });
    navigate('/');
  };

  const roleCard = (r: { id: UserRole; label: string; desc: string; icon: typeof Users }, span = false) => {
    const Icon = r.icon;
    const active = role === r.id;
    return (
      <button
        key={r.id}
        type="button"
        onClick={() => { setRole(r.id); setError(''); }}
        className={cn(
          'group flex items-start gap-3 p-3.5 rounded-2xl border-2 text-left transition-all duration-250',
          span && 'sm:col-span-2',
          active
            ? 'border-blue-600 bg-blue-50/70 card-active-glow'
            : 'border-slate-200 hover:border-blue-300 hover:shadow-soft hover:-translate-y-0.5',
        )}
      >
        <span className={cn(
          'w-9 h-9 rounded-xl grid place-items-center shrink-0 transition-all duration-250',
          active ? 'bg-blue-600 text-white shadow-glow-blue' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600',
        )}>
          <Icon className="w-4.5 h-4.5" />
        </span>
        <span className="min-w-0">
          <span className={cn('text-sm font-semibold block', active ? 'text-blue-900' : 'text-slate-800')}>{r.label}</span>
          <span className="text-[11px] text-slate-500 block mt-0.5 leading-snug">{r.desc}</span>
        </span>
        {active && (
          <motion.span layoutId="roleCheck" className="ml-auto w-5 h-5 rounded-full bg-blue-600 grid place-items-center shrink-0 self-center">
            <ShieldCheck className="w-3 h-3 text-white" />
          </motion.span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      {/* ══ Panneau branding (desktop) ══ */}
      <aside className="hidden lg:flex bg-mesh-dark relative overflow-hidden flex-col justify-between p-12 text-slate-200">
        <div className="pointer-events-none absolute -top-20 -left-16 w-80 h-80 rounded-full bg-blue-600/20 blur-3xl animate-float-y" />
        <div className="pointer-events-none absolute bottom-10 -right-16 w-96 h-96 rounded-full bg-violet-600/20 blur-3xl animate-float-y" style={{ animationDelay: '1.4s' }} />

        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 grid place-items-center shadow-glow-blue">
            <ShieldPlus className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-lg leading-none tracking-tight">Hospitalis</p>
            <p className="text-[11px] text-slate-400 mt-1">Gestion hospitalière intelligente</p>
          </div>
        </div>

        <div className="relative space-y-8 max-w-md">
          <h1 className="text-4xl font-bold tracking-tight text-white leading-tight">
            Chaque service,
            <span className="block bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">un seul flux.</span>
          </h1>
          <ul className="space-y-4">
            {[
              { icon: Stethoscope, t: 'Consultations enrichies', d: 'Dictée vocale IA qui remplit dossier et ordonnances' },
              { icon: Banknote, d: 'Tarifs catalogue, assurances plafonnées, reçus imprimables', t: 'Caisse fiable' },
              { icon: Activity, t: 'Résultats en temps réel', d: 'Labo, imagerie et pharmacie alimentent le dossier' },
            ].map(({ icon: Icon, t, d }) => (
              <li key={t} className="flex items-start gap-3.5">
                <span className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 grid place-items-center shrink-0 backdrop-blur">
                  <Icon className="w-4.5 h-4.5 text-blue-300" />
                </span>
                <span>
                  <span className="font-semibold text-white text-sm block">{t}</span>
                  <span className="text-xs text-slate-400 block mt-0.5 leading-relaxed">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] text-slate-500 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5" /> {hospitalProfile.name} · {hospitalProfile.city}
        </p>
      </aside>

      {/* ══ Formulaire ══ */}
      <main className="flex items-center justify-center p-6 sm:p-10 bg-slate-50">
        <div className={cn('w-full max-w-md space-y-7', shake && 'animate-shake')}>
          {/* En-tête mobile */}
          <div className="lg:hidden flex items-center gap-3 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 grid place-items-center shadow-glow-blue">
              <ShieldPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900 leading-none">Hospitalis</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{hospitalProfile.name}</p>
            </div>
          </div>

          {/* Segmented Connexion / Créer */}
          <div className="relative grid grid-cols-2 p-1 bg-slate-200/60 rounded-2xl">
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={cn(
                  'relative z-10 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold transition-colors duration-250',
                  mode === m ? 'text-blue-700' : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {mode === m && (
                  <motion.span
                    layoutId="authModePill"
                    className="absolute inset-0 bg-white rounded-xl shadow-soft"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  {m === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  {m === 'login' ? 'Connexion' : 'Créer un compte'}
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-1.5 text-center lg:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {mode === 'login' ? 'Bon retour !' : 'Rejoignez l\'équipe'}
            </h2>
            <p className="text-sm text-slate-500">
              {mode === 'login'
                ? 'Identifiez-vous pour reprendre votre journée.'
                : 'Un compte par membre du personnel — choisissez votre rôle.'}
            </p>
          </div>

          {/* Formulaire animé */}
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="bg-white rounded-3xl border border-slate-200/70 shadow-lift p-6 sm:p-7 space-y-5"
            >
              {/* Nom */}
              <div>
                <label className="text-micro block mb-1.5">Nom complet</label>
                <div className="relative">
                  <Input
                    value={name}
                    onChange={e => { setName(e.target.value); setError(''); }}
                    placeholder="Dr Jane Doe"
                    className="h-11 pr-10"
                    autoFocus
                  />
                  <AnimatePresence>
                    {existing && (
                      <motion.span
                        initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-emerald-100 border border-emerald-300 grid place-items-center"
                        title={`Compte existant : ${existing.name} (${existing.role})`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                {existing && (
                  <p className="text-[11px] text-emerald-700 mt-1.5 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Compte existant ({existing.role.replace('_', ' ')}) — saisissez son mot de passe pour vous connecter.
                  </p>
                )}
              </div>

              {/* Inscription : rôles + service */}
              {mode === 'register' && (
                <>
                  <div>
                    <p className="text-micro mb-2">Volet médical</p>
                    <div className="grid sm:grid-cols-2 gap-2.5">
                      {availableMedical.map(r => roleCard(r))}
                    </div>
                  </div>
                  <div>
                    <p className="text-micro mb-2">Volet administratif</p>
                    <div className="grid sm:grid-cols-2 gap-2.5">
                      {ADMIN_ROLES.map(r => roleCard(r, r.id === 'super_admin'))}
                    </div>
                  </div>

                  <AnimatePresence>
                    {needsService && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <label className="text-micro block mb-1.5">Service d'affectation (polyclinique)</label>
                        <select
                          className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
                          value={service}
                          onChange={e => setService(e.target.value)}
                        >
                          <option value="" disabled>Sélectionner…</option>
                          {services.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}

              {/* Mot de passe */}
              <div>
                <label className="text-micro block mb-1.5">Mot de passe</label>
                <div className="relative">
                  <Input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    placeholder="••••••••"
                    className="h-11 pr-11"
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors" aria-label={showPwd ? 'Masquer' : 'Afficher'}>
                    {showPwd ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 animate-in fade-in duration-200">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                className={cn(
                  'btn-sheen w-full h-12 rounded-xl text-base font-semibold',
                  mode === 'login'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 shadow-glow-blue'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 shadow-lg shadow-emerald-600/30',
                )}
              >
                {mode === 'login'
                  ? <>Se connecter <ArrowLeftRight className="w-4.5 h-4.5 ml-2 rotate-90" /></>
                  : <>Créer mon compte <UserPlus className="w-4.5 h-4.5 ml-2" /></>}
              </Button>

              <p className="text-center text-xs text-slate-400">
                {mode === 'login' ? (
                  <>Nouveau membre de l'équipe ?{' '}
                    <button type="button" onClick={() => switchMode('register')} className="font-semibold text-blue-600 hover:underline">Créer un compte</button>
                  </>
                ) : (
                  <>Vous avez déjà un compte ?{' '}
                    <button type="button" onClick={() => switchMode('login')} className="font-semibold text-blue-600 hover:underline">Se connecter</button>
                  </>
                )}
              </p>
            </motion.div>
          </AnimatePresence>

          <p className="text-center text-micro">🔒 Données hébergées localement dans ce navigateur</p>
        </div>
      </main>
    </div>
  );
}
