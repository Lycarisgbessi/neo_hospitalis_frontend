import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, UserRole, generateId, hashPassword } from '../context/AppContext';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ShieldPlus, Stethoscope, UserCog, AlertCircle } from 'lucide-react';

export default function AuthPage() {
  const { registerUser, login, findUserByName, architectureMode, activeModules } = useApp();
  const navigate = useNavigate();
  const [volet, setVolet] = useState<'medical' | 'administratif' | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [service, setService] = useState<string>('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Un nom déjà inscrit bascule l'écran en mode Connexion (mot de passe vérifié),
  // sinon il s'agit d'une Inscription (création du compte dans le registre).
  const existingUser = name.trim() ? findUserByName(name) : undefined;
  const isLoginMode = Boolean(existingUser);

  const handleLogin = () => {
    setError('');
    if (!volet || !role || !name.trim() || !password) return;

    if (isLoginMode && existingUser) {
      // ── Connexion : vérification du mot de passe et du rôle inscrit ──
      if (existingUser.passwordHash !== hashPassword(password)) {
        setError('Mot de passe incorrect pour ce compte.');
        return;
      }
      if (existingUser.role !== role) {
        setError(`Ce compte est inscrit avec le rôle « ${existingUser.role.replace('_', ' ')} ». Sélectionnez-le pour vous connecter.`);
        return;
      }
      login(existingUser);
    } else {
      // ── Inscription : création du compte dans le registre ──
      if (password.length < 4) {
        setError('Le mot de passe doit contenir au moins 4 caractères.');
        return;
      }
      registerUser({
        id: generateId('USR'),
        name: name.trim(),
        volet,
        role,
        // Audit W3 : le service d'affectation ne concerne que les MÉDECINS en
        // polyclinique — techniciens, pharmaciens et sage-femmes n'en ont pas.
        service: architectureMode === 'polyclinic' && role === 'medecin' ? service : undefined,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
      });
    }
    navigate('/');
  };

  const medicalRoles: { id: UserRole; label: string }[] = [
    { id: 'medecin', label: 'Médecin' },
    { id: 'infirmier', label: 'Infirmier/ère' },
    ...(activeModules.pharmacie ? [{ id: 'pharmacien' as UserRole, label: 'Pharmacien' }] : []),
    ...(activeModules.laboratoire ? [{ id: 'technicien_labo' as UserRole, label: 'Technicien Laboratoire' }] : []),
    ...(activeModules.imagerie ? [{ id: 'technicien_imagerie' as UserRole, label: 'Technicien Imagerie' }] : []),
    ...(activeModules.gynecologie ? [{ id: 'sage_femme' as UserRole, label: 'Sage-femme' }] : []),
  ];

  const adminRoles: { id: UserRole; label: string }[] = [
    { id: 'receptionniste', label: 'Réceptionniste' },
    { id: 'caissier', label: 'Caissier' },
    { id: 'comptable', label: 'Comptable' },
    { id: 'super_admin', label: 'Super Administrateur' },
  ];

  const services = [
    ...(activeModules.cardiologie ? [{ id: 'cardiologie', label: 'Cardiologie' }] : []),
    ...(activeModules.gynecologie ? [{ id: 'gynecologie', label: 'Gynécologie' }] : []),
    ...(activeModules.pediatrie ? [{ id: 'pediatrie', label: 'Pédiatrie' }] : []),
    ...(activeModules.chirurgie ? [{ id: 'chirurgie', label: 'Chirurgie' }] : []),
    { id: 'general', label: 'Général' },
  ];

  const canSubmit = Boolean(
    volet && role && name.trim() && password &&
    !(volet === 'medical' && architectureMode === 'polyclinic' && role === 'medecin' && !service)
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center flex flex-col items-center">
        <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-4 text-blue-600">
          <ShieldPlus className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Hospitalis</h1>
        <p className="text-slate-500">Portail de Connexion</p>
      </div>

      <Card className="w-full max-w-md border-slate-200">
        <CardContent className="p-6 space-y-6">
          {!volet ? (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4 text-center">Sélectionnez votre domaine</h2>
              <button
                onClick={() => setVolet('medical')}
                className="w-full flex items-center p-4 border border-slate-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-colors group"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-blue-200 transition-colors">
                  <Stethoscope className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-slate-900">Volet Médical</h3>
                  <p className="text-sm text-slate-500">Médecins, infirmiers, labo, etc.</p>
                </div>
              </button>
              <button
                onClick={() => setVolet('administratif')}
                className="w-full flex items-center p-4 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors group"
              >
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-slate-200 transition-colors">
                  <UserCog className="w-5 h-5 text-slate-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-slate-900">Volet Administratif</h3>
                  <p className="text-sm text-slate-500">Accueil, caisse, comptabilité, etc.</p>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                  {isLoginMode ? 'Connexion' : 'Inscription'} {volet === 'medical' ? 'Médicale' : 'Administrative'}
                </h2>
                <button onClick={() => { setVolet(null); setError(''); }} className="text-xs text-blue-600 hover:underline">Changer</button>
              </div>

              {isLoginMode && (
                <div className="flex items-start p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                  <AlertCircle className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
                  <span>« {existingUser?.name} » possède déjà un compte. Saisissez son mot de passe pour vous connecter.</span>
                </div>
              )}
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Nom et Prénom</label>
                  <Input value={name} onChange={e => { setName(e.target.value); setError(''); }} placeholder="Dr. Jane Doe" />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Mot de passe</label>
                  <Input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} placeholder="••••••••" />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Rôle {isLoginMode && <span className="text-slate-400 font-normal">(rôle inscrit obligatoire)</span>}</label>
                  <select 
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600"
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    value={role || ''}
                  >
                    <option value="" disabled>Sélectionner un rôle</option>
                    {(volet === 'medical' ? medicalRoles : adminRoles).map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </div>

                {volet === 'medical' && architectureMode === 'polyclinic' && role === 'medecin' && (
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">Service d'affectation</label>
                    <select 
                      className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600"
                      onChange={(e) => setService(e.target.value)}
                      value={service}
                    >
                      <option value="" disabled>Sélectionner un service</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start">
                  <AlertCircle className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <div className="pt-4">
                <Button className="w-full" onClick={handleLogin} disabled={!canSubmit}>
                  {isLoginMode ? 'Se connecter' : 'Créer le compte & Accéder'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
