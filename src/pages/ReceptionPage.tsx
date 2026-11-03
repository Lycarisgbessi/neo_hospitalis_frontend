import React, { useState, useEffect } from 'react';
import { useApp, Patient, Order, generateId, PRICING_CATALOG, OrderType } from '../context/AppContext';
import { useAI } from '../context/AIContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';
import { useToast } from '../components/Toast';
import { SuccessCheck } from '../components/SuccessCheck';
import { UserPlus, CheckCircle2, Users, Search, Activity, UserCog, FlaskConical, Camera, CalendarDays, AlertTriangle } from 'lucide-react';

/** Examens proposés en accès direct (tarifs = catalogue, jamais inventés). */
const DIRECT_LAB_TESTS = ['NFS', 'Goutte épaisse', 'Glycémie à jeun', 'Groupage sanguin', 'CRP', 'Transaminases (ASAT/ALAT)', 'Test de grossesse (β-HCG)', 'Sérologie VIH'];
const DIRECT_IMAGING_EXAMS = ['Radiographie Thorax', 'Échographie Abdominale', 'Échographie Pelvienne', 'Échographie Obstétricale', 'Radiographie Membre', 'Scanner (TDM)'];

type AdmissionMode = 'consultation' | 'exam_direct';

export default function ReceptionPage() {
  const { patients, addPatient, addOrder, activeModules, architectureMode } = useApp();

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [phone, setPhone] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [rhFactor, setRhFactor] = useState('');
  const [profession, setProfession] = useState('');
  const [companionName, setCompanionName] = useState('');
  const [companionPhone, setCompanionPhone] = useState('');
  const [targetService, setTargetService] = useState('general');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [showAllTime, setShowAllTime] = useState(false);

  // Mode d'admission : consultation (standard) ou accès direct aux examens
  const [admissionMode, setAdmissionMode] = useState<AdmissionMode>('consultation');
  const [directLab, setDirectLab] = useState<string[]>([]);
  const [directImaging, setDirectImaging] = useState<string[]>([]);
  const [externalPrescriber, setExternalPrescriber] = useState('');

  const { registerPage, unregisterPage } = useAI();
  const toast = useToast();

  useEffect(() => {
    registerPage(
      'Réception (Admission)',
      {
        name: "Nom complet du patient",
        age: "Âge en entier",
        gender: "M ou F",
        targetService: "general, cardiologie, gynecologie, pediatrie, ou chirurgie",
        phone: "Numéro de téléphone",
        city: "Ville de résidence"
      },
      (action) => {
        if (action.type === 'fill_form' && action.payload) {
          const payload = action.payload as Record<string, unknown>;
          if (typeof payload.name === 'string' && payload.name) setName(payload.name);
          if (payload.age !== undefined && payload.age !== null) setAge(payload.age.toString());
          if (payload.gender === 'M' || payload.gender === 'F') setGender(payload.gender);
          if (typeof payload.targetService === 'string' && payload.targetService) setTargetService(payload.targetService.toLowerCase());
          if (typeof payload.phone === 'string' && payload.phone) setPhone(payload.phone);
          if (typeof payload.city === 'string' && payload.city) setCity(payload.city);
        }
      }
    );
    return () => unregisterPage();
  }, [registerPage, unregisterPage]);

  // Gyneco Triage States
  const [motifPrincipal, setMotifPrincipal] = useState('Consultation gynecologique');
  const [situationObstetricale, setSituationObstetricale] = useState('Pas de grossesse en cours');
  const [grossessesAnterieures, setGrossessesAnterieures] = useState('0');
  const [parites, setParites] = useState('0');
  const [ageGestationnel, setAgeGestationnel] = useState('');
  const [urgence, setUrgence] = useState(false);
  const [urgenceDesc, setUrgenceDesc] = useState('');
  const [referee, setReferee] = useState(false);
  const [refereeDesc, setRefereeDesc] = useState('');
  const [typeAdmission, setTypeAdmission] = useState('Consultation externe');

  // Pediatrie Triage States
  const [pedMotif, setPedMotif] = useState('Consultation routine');
  const [pedPoids, setPedPoids] = useState('');
  const [pedTemp, setPedTemp] = useState('');
  const [pedNutrition, setPedNutrition] = useState('Normal');
  const [pedUrgence, setPedUrgence] = useState(false);
  const [pedUrgenceDesc, setPedUrgenceDesc] = useState('');
  const [pedSignes, setPedSignes] = useState('');
  const [pedRefere, setPedRefere] = useState(false);
  const [pedRefereDesc, setPedRefereDesc] = useState('');

  const availableServices = [
    { id: 'general', label: 'Médecine Générale' },
    ...(activeModules.cardiologie ? [{ id: 'cardiologie', label: 'Cardiologie' }] : []),
    ...(activeModules.gynecologie ? [{ id: 'gynecologie', label: 'Gynécologie-Obstétrique' }] : []),
    ...(activeModules.pediatrie ? [{ id: 'pediatrie', label: 'Pédiatrie' }] : []),
    ...(activeModules.chirurgie ? [{ id: 'chirurgie', label: 'Chirurgie' }] : []),
  ];

  const resetIdentityFields = () => {
    setName(''); setAge(''); setPhone(''); setFatherName(''); setMotherName(''); setNeighborhood(''); setCity('');
    setBloodGroup(''); setRhFactor(''); setProfession(''); setCompanionName(''); setCompanionPhone('');
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !age) return;

    if (admissionMode === 'exam_direct' && directLab.length === 0 && directImaging.length === 0) {
      toast.error('Sélectionnez au moins un examen à réaliser (laboratoire ou imagerie).');
      return;
    }

    // Audit C1 — détection de doublon : même nom (insensible casse) + même âge
    const duplicate = patients.find(p =>
      p.name.trim().toLowerCase() === name.trim().toLowerCase() && p.age === parseInt(age)
    );
    if (duplicate) {
      const create = window.confirm(
        `Un dossier similaire existe déjà :\n\n« ${duplicate.name} », ${duplicate.age} ans — ID ${duplicate.id} (statut: ${duplicate.status})\n\nCréer quand même un nouveau dossier ?`
      );
      if (!create) return;
    }

    const isExamDirect = admissionMode === 'exam_direct';

    const newPatient: Patient = {
      id: generateId(`PAT-${new Date().getFullYear()}`),
      name,
      // Audit Y2 : âge borné [0, 120] (les valeurs saisies hors bornes sont écrétées)
      age: Math.min(120, Math.max(0, parseInt(age) || 0)),
      gender,
      phone,
      fatherName,
      motherName,
      neighborhood,
      city,
      bloodGroup,
      rhFactor,
      profession,
      companionName,
      companionPhone,
      arrivalTime: new Date().toISOString(),
      status: 'waiting_payment',
      targetService: isExamDirect ? 'general' : targetService,
      consultationFeePaid: false,
      admissionType: admissionMode,
      externalPrescriber: isExamDirect ? (externalPrescriber || 'Prescription externe') : undefined,
      history: [],
      ...(targetService === 'gynecologie' && !isExamDirect && {
        gynecoTriage: {
          motifPrincipal,
          situationObstetricale,
          grossessesAnterieures: parseInt(grossessesAnterieures) || 0,
          parites: parseInt(parites) || 0,
          ageGestationnel,
          urgence,
          urgenceDesc,
          referee,
          refereeDesc,
          typeAdmission
        }
      }),
      ...(targetService === 'pediatrie' && !isExamDirect && {
        pediatrieTriage: {
          motif: pedMotif,
          poidsEstime: pedPoids,
          tempEstimee: pedTemp,
          nutrition: pedNutrition,
          urgence: pedUrgence,
          urgenceDesc: pedUrgenceDesc,
          signesDanger: pedSignes,
          referee: pedRefere,
          refereeDesc: pedRefereDesc
        }
      })
    };

    addPatient(newPatient);

    // Accès direct : création immédiate des ordres d'examens (tarifs catalogue)
    if (isExamDirect) {
      const base = { patientId: newPatient.id, status: 'pending' as const, date: new Date().toISOString(), prescribedBy: externalPrescriber || 'Prescription externe' };
      if (directLab.length > 0) {
        const order: Order = {
          id: generateId('ORD'), type: 'lab', ...base,
          details: `Analyses demandées :\n${directLab.map(t => `- ${t}`).join('\n')}`,
          fee: PRICING_CATALOG.lab,
        };
        addOrder(order);
      }
      directImaging.forEach(exam => {
        const order: Order = {
          id: generateId('ORD'), type: 'imagerie', ...base,
          details: `Type: ${exam}\nRégion: -\nIndication Clinique: Examen demandé en accès direct (${externalPrescriber || 'prescription externe'})`,
          fee: PRICING_CATALOG.imagerie,
        };
        addOrder(order);
      });
      setDirectLab([]);
      setDirectImaging([]);
      setExternalPrescriber('');
      setSuccessMsg(`Dossier créé. Le patient doit régler ses examens à la caisse (${directLab.length + directImaging.length} acte${(directLab.length + directImaging.length) > 1 ? 's' : ''}), puis se présenter directement au service — sans consultation.`);
    } else {
      setSuccessMsg('Dossier créé et notification envoyée à la caisse pour le règlement de la consultation.');
    }

    setShowSuccess(true);
    resetIdentityFields();

    window.setTimeout(() => setShowSuccess(false), 6000);
  };

  // Audit C2 — file du jour par défaut, bascule pour voir tout l'historique
  const todayKey = new Date().toISOString().slice(0, 10);
  const filteredPatients = patients.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchDay = showAllTime || (p.arrivalTime ?? '').slice(0, 10) === todayKey;
    return matchSearch && matchDay;
  });

  const statusBadge = (p: Patient) => {
    if (p.admissionType === 'exam_direct') {
      if (p.status === 'treated') return <Badge variant="success">Examen terminé</Badge>;
      return p.status === 'waiting_payment'
        ? <Badge variant="warning" className="border-purple-200">Examen — Attente Caisse</Badge>
        : <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Examens en cours</Badge>;
    }
    if (p.status === 'waiting_payment') return <Badge variant="warning" className="border-orange-200">Attente Caisse</Badge>;
    if (p.status === 'waiting_consultation') return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Attente Médecin</Badge>;
    if (p.status === 'hospitalized') return <Badge variant="destructive">Hospitalisé</Badge>;
    if (p.status === 'treated') return <Badge variant="success">Consulté</Badge>;
    return <Badge variant="outline">{p.status}</Badge>;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Accueil & Enregistrement</h1>
          <p className="text-slate-500 mt-1">Gérez les admissions et l'orientation des patients.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 border-0 shadow-md ring-1 ring-slate-200">
          <CardHeader className="bg-blue-600 rounded-t-xl text-white">
            <CardTitle className="text-xl flex items-center">
              <UserPlus className="w-5 h-5 mr-3 opacity-80" />
              Admission Patient
            </CardTitle>
            <CardDescription className="text-blue-100">Création d'un nouveau dossier médical</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {showSuccess ? (
              <div className="py-12 text-center flex flex-col items-center">
                <div className="mb-4 flex justify-center"><SuccessCheck size={72} /></div>
                <h3 className="text-lg font-bold text-slate-900">Patient enregistré avec succès</h3>
                <p className="text-sm text-slate-500 mt-2">{successMsg}</p>
                <Button className="mt-8" variant="outline" onClick={() => setShowSuccess(false)}>Nouveau patient</Button>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-5">
                {/* Mode d'admission (audit A3) */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setAdmissionMode('consultation')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${admissionMode === 'consultation' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Consultation
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdmissionMode('exam_direct')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center ${admissionMode === 'exam_direct' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <FlaskConical className="w-3.5 h-3.5 mr-1.5" /> Examen direct
                  </button>
                </div>
                {admissionMode === 'exam_direct' && (
                  <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-800 flex items-start">
                    <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
                    Patient adressé pour des examens uniquement : pas de frais de consultation, pas de passage médecin. Les examens sélectionnés seront à régler en caisse puis exécutés par le service ; le dossier se clôture automatiquement à la fin des examens.
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Nom complet <span className="text-red-500">*</span></label>
                  <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Ex: Aissatou Diallo" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Âge <span className="text-red-500">*</span></label>
                    <Input type="number" value={age} onChange={e => setAge(e.target.value)} required placeholder="Années" min="0" max="120" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Sexe <span className="text-red-500">*</span></label>
                    <select
                      className="w-full h-9 rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600"
                      value={gender}
                      onChange={e => setGender(e.target.value as 'M' | 'F')}
                    >
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Nom du père</label>
                    <Input value={fatherName} onChange={e => setFatherName(e.target.value)} placeholder="Ex: Amadou Diallo" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Nom de la mère</label>
                    <Input value={motherName} onChange={e => setMotherName(e.target.value)} placeholder="Ex: Fatoumata Barry" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Téléphone</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Ex: 622 00 00 00" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Quartier</label>
                    <Input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="Ex: Ratoma, Kipé" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Ville</label>
                    <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Ex: Conakry" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Profession</label>
                     <Input value={profession} onChange={e => setProfession(e.target.value)} placeholder="Ex: Enseignant" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                     <div>
                        <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Gr. Sanguin</label>
                        <select className="w-full h-9 rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm" value={bloodGroup} onChange={e => setBloodGroup(e.target.value)}>
                           <option value="">-</option><option value="A">A</option><option value="B">B</option><option value="AB">AB</option><option value="O">O</option>
                        </select>
                     </div>
                     <div>
                        <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Rhésus</label>
                        <select className="w-full h-9 rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm" value={rhFactor} onChange={e => setRhFactor(e.target.value)}>
                           <option value="">-</option><option value="+">+</option><option value="-">-</option>
                        </select>
                     </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100">
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Personne à prévenir / Accompagnant</h4>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Nom complet</label>
                         <Input value={companionName} onChange={e => setCompanionName(e.target.value)} placeholder="Ex: Ousmane Sow" />
                      </div>
                      <div>
                         <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Contact</label>
                         <Input value={companionPhone} onChange={e => setCompanionPhone(e.target.value)} placeholder="Téléphone" />
                      </div>
                   </div>
                </div>

                {admissionMode === 'consultation' && (
                  <>
                    <div className="pt-2">
                      <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Orientation (Service) <span className="text-red-500">*</span></label>
                      <select
                        className="w-full h-10 rounded-md border-2 border-blue-100 bg-blue-50/30 px-3 py-1 text-sm font-medium text-blue-900 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600"
                        value={targetService}
                        onChange={e => setTargetService(e.target.value)}
                      >
                        {availableServices.map(s => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>

                    {targetService === 'gynecologie' && (
                      <div className="pt-4 mt-4 border-t border-rose-100 bg-rose-50/50 p-4 rounded-xl space-y-4">
                        <h4 className="text-xs font-bold text-rose-800 uppercase tracking-widest mb-2 flex items-center">
                           <Activity className="w-4 h-4 mr-2" /> Triage Gynéco-Obstétrique
                        </h4>

                        <div>
                           <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Motif principal de la visite <span className="text-red-500">*</span></label>
                           <select className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm" value={motifPrincipal} onChange={e => setMotifPrincipal(e.target.value)}>
                              <option value="Consultation gynecologique">Consultation gynécologique</option>
                              <option value="Consultation prenatale">Consultation prénatale</option>
                              <option value="Suivi de grossesse">Suivi de grossesse</option>
                              <option value="Planification familiale">Planification familiale</option>
                              <option value="Procreation medicalement assistee">Procréation médicalement assistée</option>
                              <option value="Urgence obstetricale">Urgence obstétricale</option>
                              <option value="Post-partum">Post-partum</option>
                              <option value="Autre">Autre</option>
                           </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Situation Obstétricale</label>
                              <select className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm" value={situationObstetricale} onChange={e => setSituationObstetricale(e.target.value)}>
                                 <option value="Pas de grossesse en cours">Pas de grossesse en cours</option>
                                 <option value="Grossesse en cours">Grossesse en cours</option>
                                 <option value="Post-partum">Post-partum</option>
                                 <option value="Infertilite">Infertilité</option>
                                 <option value="Non concernee">Non concernée</option>
                              </select>
                           </div>
                           <div>
                              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Type d'admission</label>
                              <select className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm" value={typeAdmission} onChange={e => setTypeAdmission(e.target.value)}>
                                 <option value="Consultation externe">Consultation externe</option>
                                 <option value="Hospitalisation programmee">Hospitalisation programmée</option>
                                 <option value="Urgence">Urgence</option>
                                 <option value="Transfert inter-etablissement">Transfert inter-établissement</option>
                              </select>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Grossesses antérieures (G)</label>
                              <Input type="number" min="0" value={grossessesAnterieures} onChange={e => setGrossessesAnterieures(e.target.value)} className="bg-white" />
                           </div>
                           <div>
                              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Parités (P)</label>
                              <Input type="number" min="0" value={parites} onChange={e => setParites(e.target.value)} className="bg-white" />
                           </div>
                        </div>

                        {situationObstetricale === 'Grossesse en cours' && (
                          <div>
                             <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Âge gestationnel (si connu)</label>
                             <Input value={ageGestationnel} onChange={e => setAgeGestationnel(e.target.value)} placeholder="Ex: 2ème trimestre, 16 SA" className="bg-white" />
                          </div>
                        )}

                        <div className="space-y-3 pt-2">
                           <label className="flex items-center space-x-3 text-sm font-medium text-rose-900 bg-rose-100 p-3 rounded-lg border border-rose-200 cursor-pointer">
                              <input type="checkbox" checked={urgence} onChange={e => setUrgence(e.target.checked)} className="w-4 h-4 text-rose-600 rounded" />
                              <span>Marquer comme urgence obstétricale</span>
                           </label>
                           {urgence && (
                              <Input value={urgenceDesc} onChange={e => setUrgenceDesc(e.target.value)} placeholder="Motif de l'urgence..." className="bg-white border-rose-300 focus-visible:ring-rose-500" required />
                           )}

                           <label className="flex items-center space-x-3 text-sm font-medium text-slate-700 bg-white p-3 rounded-lg border border-slate-200 cursor-pointer">
                              <input type="checkbox" checked={referee} onChange={e => setReferee(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                              <span>Patiente référée (d'un autre centre)</span>
                           </label>
                           {referee && (
                              <Input value={refereeDesc} onChange={e => setRefereeDesc(e.target.value)} placeholder="Centre d'origine et motif..." className="bg-white" required />
                           )}
                        </div>
                      </div>
                    )}

                     {targetService === 'pediatrie' && (
                      <div className="pt-4 mt-4 border-t border-sky-100 bg-sky-50/50 p-4 rounded-xl space-y-4">
                        <h4 className="text-xs font-bold text-sky-800 uppercase tracking-widest mb-2 flex items-center">
                           <Activity className="w-4 h-4 mr-2" /> Triage Pédiatrique
                        </h4>

                        <div>
                           <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Motif principal de la visite <span className="text-red-500">*</span></label>
                           <select className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm" value={pedMotif} onChange={e => setPedMotif(e.target.value)}>
                              <option value="Consultation routine">Consultation routine</option>
                              <option value="Vaccination">Vaccination</option>
                              <option value="Fievre">Fièvre</option>
                              <option value="Diarrhee">Diarrhée</option>
                              <option value="Toux">Toux</option>
                              <option value="Malnutrition">Malnutrition</option>
                              <option value="Suivi croissance">Suivi croissance</option>
                              <option value="Urgence">Urgence</option>
                              <option value="Autre">Autre</option>
                           </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Poids estimé (kg)</label>
                              <Input type="number" step="0.1" value={pedPoids} onChange={e => setPedPoids(e.target.value)} className="bg-white" />
                           </div>
                           <div>
                              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Temp. estimée (°C)</label>
                              <Input type="number" step="0.1" value={pedTemp} onChange={e => setPedTemp(e.target.value)} className="bg-white" />
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                               <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Situation nutritionnelle apparente</label>
                               <select className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm" value={pedNutrition} onChange={e => setPedNutrition(e.target.value)}>
                                  <option value="Normal">Normal</option>
                                  <option value="Maigre">Maigre</option>
                                  <option value="Tres maigre">Très maigre</option>
                                  <option value="Oedemes">Œdèmes</option>
                                  <option value="Non evalue">Non évalué</option>
                               </select>
                            </div>
                            <div>
                               <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Signes de danger généraux</label>
                               <select className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm" value={pedSignes} onChange={e => setPedSignes(e.target.value)}>
                                  <option value="">(Aucun)</option>
                                  <option value="Ne boit pas / Ne tete pas">Ne boit pas / Ne tète pas</option>
                                  <option value="Vomit tout">Vomit tout</option>
                                  <option value="Convulsions">Convulsions</option>
                                  <option value="Lethargique / Difficile a reveiller">Léthargique / Difficile à réveiller</option>
                               </select>
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                           <label className="flex items-center space-x-3 text-sm font-medium text-sky-900 bg-sky-100 p-3 rounded-lg border border-sky-200 cursor-pointer">
                              <input type="checkbox" checked={pedUrgence} onChange={e => setPedUrgence(e.target.checked)} className="w-4 h-4 text-sky-600 rounded" />
                              <span>Marquer comme urgence pédiatrique</span>
                           </label>
                           {pedUrgence && (
                              <Input value={pedUrgenceDesc} onChange={e => setPedUrgenceDesc(e.target.value)} placeholder="Type (convulsions, détresse repiratoire, choc...)" className="bg-white border-sky-300 focus-visible:ring-sky-500" required />
                           )}

                           <label className="flex items-center space-x-3 text-sm font-medium text-slate-700 bg-white p-3 rounded-lg border border-slate-200 cursor-pointer">
                              <input type="checkbox" checked={pedRefere} onChange={e => setPedRefere(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                              <span>Enfant référé (d'un autre centre)</span>
                           </label>
                           {pedRefere && (
                              <Input value={pedRefereDesc} onChange={e => setPedRefereDesc(e.target.value)} placeholder="Etablissement d'origine et motif..." className="bg-white" required />
                           )}
                        </div>
                      </div>
                     )}
                  </>
                )}

                {admissionMode === 'exam_direct' && (
                  <div className="pt-4 mt-4 border-t border-purple-100 space-y-4">
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Prescripteur externe</label>
                      <Input value={externalPrescriber} onChange={e => setExternalPrescriber(e.target.value)} placeholder="Ex: Dr Camara (Clinique Kipé)" className="bg-white" />
                    </div>
                    {activeModules.laboratoire && (
                      <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4 space-y-2">
                        <h4 className="text-xs font-bold text-purple-800 uppercase tracking-widest flex items-center"><FlaskConical className="w-4 h-4 mr-2" /> Analyses demandées</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {DIRECT_LAB_TESTS.map(t => (
                            <label key={t} className={`flex items-center p-2 rounded-lg border cursor-pointer text-xs font-medium transition-colors ${directLab.includes(t) ? 'border-purple-400 bg-white text-purple-900' : 'border-slate-200 bg-white/60 text-slate-600 hover:border-purple-200'}`}>
                              <input
                                type="checkbox"
                                className="mr-2 w-3.5 h-3.5 rounded text-purple-600"
                                checked={directLab.includes(t)}
                                onChange={() => setDirectLab(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                              />
                              {t}
                            </label>
                          ))}
                        </div>
                        <p className="text-[10px] text-purple-500">Tarif caisse : {PRICING_CATALOG.lab.toLocaleString('fr-GN')} FG le bon (bilan)</p>
                      </div>
                    )}
                    {activeModules.imagerie && (
                      <div className="bg-cyan-50/50 border border-cyan-100 rounded-xl p-4 space-y-2">
                        <h4 className="text-xs font-bold text-cyan-800 uppercase tracking-widest flex items-center"><Camera className="w-4 h-4 mr-2" /> Examens d'imagerie demandés</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {DIRECT_IMAGING_EXAMS.map(t => (
                            <label key={t} className={`flex items-center p-2 rounded-lg border cursor-pointer text-xs font-medium transition-colors ${directImaging.includes(t) ? 'border-cyan-400 bg-white text-cyan-900' : 'border-slate-200 bg-white/60 text-slate-600 hover:border-cyan-200'}`}>
                              <input
                                type="checkbox"
                                className="mr-2 w-3.5 h-3.5 rounded text-cyan-600"
                                checked={directImaging.includes(t)}
                                onChange={() => setDirectImaging(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                              />
                              {t}
                            </label>
                          ))}
                        </div>
                        <p className="text-[10px] text-cyan-500">Tarif caisse : {PRICING_CATALOG.imagerie.toLocaleString('fr-GN')} FG par examen</p>
                      </div>
                    )}
                  </div>
                )}

                <Button type="submit" size="lg" className="w-full mt-4 bg-blue-600 hover:bg-blue-700 shadow-md">Enregistrer l'admission</Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-sm ring-1 ring-slate-200">
            <CardHeader className="bg-slate-50/80 border-b border-slate-100 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-lg flex items-center">
                  <Users className="w-5 h-5 mr-2 text-slate-500" />
                  File {showAllTime ? 'Complète' : 'Active du Jour'}
                </CardTitle>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={() => setShowAllTime(v => !v)} className="h-8 text-xs">
                    <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
                    {showAllTime ? 'Voir le jour' : "Voir tout l'historique"}
                  </Button>
                  <div className="relative max-w-xs w-full">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <Input
                      placeholder="Rechercher un dossier..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 bg-white"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-100/50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Identifiant / Nom</th>
                      <th className="px-6 py-4 font-semibold">Profil</th>
                      <th className="px-6 py-4 font-semibold">Heure</th>
                      <th className="px-6 py-4 font-semibold">Orientation</th>
                      <th className="px-6 py-4 font-semibold">Statut du parcours</th>
                      <th className="px-6 py-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...filteredPatients].reverse().map(p => {
                      // Dossiers de démonstration antérieurs : fallback si l'heure d'arrivée manque.
                      const arrivalTimeFormatted = p.arrivalTime
                        ? new Date(p.arrivalTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                        : '--:--';
                      return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{p.id}</div>
                        </td>
                        <td className="px-6 py-4">
                          {p.age} ans, {p.gender}
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-600">
                          {arrivalTimeFormatted}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center capitalize text-slate-700 bg-slate-100 px-2 py-1 rounded-md text-xs font-medium border border-slate-200">
                            {p.admissionType === 'exam_direct' ? 'Examen direct' : p.targetService}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {statusBadge(p)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="ghost" size="sm" className="inline-flex md:hidden md:group-hover:inline-flex h-8" onClick={() => setSelectedPatientId(p.id)}>Détails</Button>
                        </td>
                      </tr>
                      );
                    })}
                    {filteredPatients.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            <UserCog className="w-12 h-12 mb-3 stroke-1" />
                            <p className="text-lg font-medium text-slate-600">{showAllTime ? 'Aucun patient trouvé' : 'Aucun patient aujourd\'hui'}</p>
                            <p className="text-sm mt-1">{showAllTime ? 'La recherche n\'a donné aucun résultat.' : 'Basculez sur « Voir tout l\'historique » pour les jours précédents.'}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Patient Details Dialog */}
      <Dialog open={selectedPatientId !== null} onOpenChange={(open) => !open && setSelectedPatientId(null)}>
        <DialogHeader>
          <DialogTitle>Détails du Patient</DialogTitle>
        </DialogHeader>
        {(() => {
           const patient = patients.find(p => p.id === selectedPatientId);
           if (!patient) return null;
           return (
             <div className="py-4 space-y-4 print-area">
                <div className="flex items-center space-x-4 border-b border-slate-100 pb-4">
                   <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-400 shrink-0">
                      {patient.name.charAt(0)}
                   </div>
                   <div>
                      <h3 className="text-xl font-bold text-slate-900">{patient.name}</h3>
                      <p className="text-slate-500 font-mono text-sm">{patient.id} • {patient.age} ans • {patient.gender === 'M' ? 'Homme' : 'Femme'}</p>
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                   <div>
                      <p className="text-slate-500 font-semibold mb-1">Contact & Résidence</p>
                      <p>{patient.phone || 'Non renseigné'}</p>
                      <p>{patient.neighborhood || 'Quartier non renseigné'}, {patient.city}</p>
                   </div>
                   <div>
                      <p className="text-slate-500 font-semibold mb-1">Filiation & Profil</p>
                      <p>Père: {patient.fatherName || 'Inconnu'}</p>
                      <p>Mère: {patient.motherName || 'Inconnue'}</p>
                      <p>Profession: {patient.profession || 'Non renseignée'}</p>
                   </div>
                   <div>
                      <p className="text-slate-500 font-semibold mb-1">Médical</p>
                      <p>Groupe Sanguin: <span className="font-medium text-red-600">{patient.bloodGroup || '?'} {patient.rhFactor || ''}</span></p>
                      <p>Consultations: {patient.history?.length || 0} • Dossier: {patient.medicalRecords?.length || 0} résultats</p>
                   </div>
                   <div>
                      <p className="text-slate-500 font-semibold mb-1">Accompagnant</p>
                      <p>{patient.companionName || 'Aucun'}</p>
                      <p>{patient.companionPhone || ''}</p>
                   </div>
                </div>

                {(patient.gynecoTriage || patient.pediatrieTriage) && (
                  <div className="bg-slate-50 p-4 rounded-lg mt-4 space-y-1.5">
                    <p className="text-sm font-semibold text-slate-700 mb-1">Triage à l'admission</p>
                    {patient.gynecoTriage && (
                      <div className="text-xs text-slate-600 space-y-1">
                        <p><strong>Motif :</strong> {patient.gynecoTriage.motifPrincipal} • <strong>Situation :</strong> {patient.gynecoTriage.situationObstetricale}</p>
                        <p><strong>G/P :</strong> G{patient.gynecoTriage.grossessesAnterieures} P{patient.gynecoTriage.parites} {patient.gynecoTriage.ageGestationnel ? `• ${patient.gynecoTriage.ageGestationnel}` : ''}</p>
                        {patient.gynecoTriage.urgence && <p className="text-red-700 font-semibold">⚠ Urgence : {patient.gynecoTriage.urgenceDesc}</p>}
                      </div>
                    )}
                    {patient.pediatrieTriage && (
                      <div className="text-xs text-slate-600 space-y-1">
                        <p><strong>Motif :</strong> {patient.pediatrieTriage.motif} • <strong>Nutrition :</strong> {patient.pediatrieTriage.nutrition}</p>
                        <p><strong>Poids/Temp estimés :</strong> {patient.pediatrieTriage.poidsEstime ? `${patient.pediatrieTriage.poidsEstime}kg` : '-'} / {patient.pediatrieTriage.tempEstimee ? `${patient.pediatrieTriage.tempEstimee}°C` : '-'}</p>
                        {patient.pediatrieTriage.signesDanger && <p className="text-orange-700 font-semibold">⚠ {patient.pediatrieTriage.signesDanger}</p>}
                        {patient.pediatrieTriage.urgence && <p className="text-red-700 font-semibold">⚠ Urgence : {patient.pediatrieTriage.urgenceDesc}</p>}
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-slate-50 p-4 rounded-lg mt-4">
                  <p className="text-sm font-semibold text-slate-700 mb-2">Statut de la visite</p>
                  <div className="flex items-center justify-between">
                     <span className="text-sm text-slate-600 capitalize">
                       {patient.admissionType === 'exam_direct'
                         ? `Examen direct${patient.externalPrescriber ? ` (${patient.externalPrescriber})` : ''}`
                         : `Service: ${patient.targetService}`}
                     </span>
                     {statusBadge(patient)}
                   </div>
                </div>
             </div>
           );
        })()}
        <DialogFooter>
          <Button variant="outline" onClick={() => setSelectedPatientId(null)}>Fermer</Button>
          <Button className="bg-slate-900 hover:bg-slate-800 no-print" onClick={() => window.print()}>
             Imprimer le Ticket
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
