import React, { useState, useEffect } from 'react';
import { useApp, Patient, Consultation, Order, generateId, PRICING_CATALOG } from '../context/AppContext';
import { useAI } from '../context/AIContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Badge } from '../components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { PrescriptionBuilder } from '../components/PrescriptionBuilder';
import { MedicalDictation, DictatedOrders, formatMedication } from '../components/MedicalDictation';
import { RecordsTimeline, RecordsSectionTitle } from '../components/RecordsTimeline';
import { ConsultationSpecialtyDetails } from '../components/ConsultationSpecialtyDetails';
import { Stethoscope, ClipboardList, Send, FileText, Activity, Clock, User, HeartPulse, Pill, TestTube, Crosshair, Syringe, AlertCircle, History, Search, Mic, X } from 'lucide-react';

/** Schéma de structuration de la dictée médicale (médecine générale). */
const DICTATION_SCHEMA: Record<string, string> = {
  motif: "Motif de consultation (plainte principale exprimée par le patient)",
  atcd_medicaux: "Antécédents médicaux personnels (diabète, HTA, drépanocytose...)",
  atcd_chirurgicaux: "Antécédents chirurgicaux (opérations passées)",
  atcd_familiaux: "Antécédents familiaux (maladies héréditaires)",
  allergies: "Allergies et intolérances (médicaments, aliments)",
  mode_de_vie: "Mode de vie (tabac, alcool, sédentarité, profession)",
  temperature: "Température en °C (ex: 38.5)",
  tension: "Tension artérielle (ex: 12/8 ou 120/80)",
  pouls: "Pouls en bpm (ex: 92)",
  frequence_respiratoire: "Fréquence respiratoire en cycles/minute",
  spo2: "Saturation en oxygène SpO2 en % (ex: 98)",
  poids: "Poids en kg",
  taille: "Taille en cm",
  signes_generaux: "Signes généraux (état général, conscience, coloration...)",
  signes_fonctionnels: "Signes fonctionnels par appareil (symptômes décrits)",
  inspection: "Examen physique : inspection",
  palpation: "Examen physique : palpation",
  percussion: "Examen physique : percussion",
  auscultation: "Examen physique : auscultation",
  anamnese: "Notes et anamnèse libre (histoire de la maladie, remarques additionnelles)",
  diagnostic_differentiel: "Diagnostics différentiels envisagés",
  diagnostic_final: "Diagnostic final retenu",
  // Audit F1 : orientation du patient pilotable à la voix
  orientation: "Service de transfert dicté par le médecin : general (médecine générale), cardiologie, gynecologie, pediatrie ou chirurgie — UNIQUEMENT si le médecin l'a explicitement dicté",
  hospitalisation: "Décision d'hospitaliser : 'oui' ou 'non' — UNIQUEMENT si le médecin l'a explicitement dictée",
};

export default function DoctorPage() {
  const { patients, updatePatient, currentUser, activeModules, addConsultation, addOrder, consultations, orders, users } = useApp();
  const { registerPage, unregisterPage } = useAI();

  
  const myPatients = patients
    .filter(p => {
      // Seuls les patients ayant réglé leur consultation sont consultables :
      // les transférés non payés et les accès-directs examens restent à la caisse.
      if (p.status === 'waiting_payment') return false;
      if (!p.consultationFeePaid) return false;
      // Médecin affecté à une spécialité (mode polyclinique) : il ne voit que les
      // patients orientés vers son service. Les médecins généralistes voient tout.
      // Comparaison normalisée (casse + espaces) pour éviter les disparitions de dossier.
      const myService = currentUser?.service?.trim().toLowerCase();
      if (myService && myService !== 'general' && myService !== p.targetService.trim().toLowerCase()) {
        return false;
      }
      return true;
    })
    // Audit R2 : patients actifs d'abord (en attente / hospitalisés), dossiers
    // clôturés en fin de file ; à statut égal, ordre d'arrivée.
    .sort((a, b) =>
      Number(a.status === 'treated') - Number(b.status === 'treated') ||
      (a.arrivalTime ?? '').localeCompare(b.arrivalTime ?? '')
    );



  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // Consultation State
  const [activeTab, setActiveTab] = useState('consultation');
  const [vitals, setVitals] = useState({ temperature: '', bloodPressure: '', heartRate: '', respiratoryRate: '', o2Saturation: '', weight: '', height: '', bmi: '' });
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [historyCards, setHistoryCards] = useState({ medical: '', surgical: '', family: '', allergies: '', lifestyle: '' });
  const [generalSigns, setGeneralSigns] = useState('');
  const [functionalSigns, setFunctionalSigns] = useState('');
  const [physicalExam, setPhysicalExam] = useState({ inspection: '', palpation: '', percussion: '', auscultation: '' });
  const [anamnese, setAnamnese] = useState('');
  const [differentialDiagnosis, setDifferentialDiagnosis] = useState('');
  const [finalDiagnosis, setFinalDiagnosis] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    registerPage(
      'Médecin (Consultation)',
      {
        chiefComplaint: "Motif de consultation",
        motif: "Motif de consultation (synonyme)",
        anamnese: "Histoire de la maladie / Anamnèse",
        finalDiagnosis: "Diagnostic final retenu",
        diagnostic_final: "Diagnostic final retenu (synonyme)",
        temperature: "Température du patient (ex: 38.5)",
        tension: "Tension artérielle (ex: 12/8)",
        pouls: "Pouls en bpm",
        poids: "Poids en kg",
        dictee: "Mettre 'oui' pour ouvrir la fenêtre de dictée médicale complète (contrôle vocal total)",
      },
      (action) => {
        if (action.type === 'fill_form' && action.payload) {
          const payload = action.payload as Record<string, unknown>;
          if (payload.dictee === 'oui' || payload.dictee === true) { setShowDictation(true); return; }
          if (typeof payload.chiefComplaint === 'string' && payload.chiefComplaint) setChiefComplaint(payload.chiefComplaint);
          else if (typeof payload.motif === 'string' && payload.motif) setChiefComplaint(payload.motif);
          if (typeof payload.anamnese === 'string' && payload.anamnese) setAnamnese(payload.anamnese);
          if (typeof payload.finalDiagnosis === 'string' && payload.finalDiagnosis) setFinalDiagnosis(payload.finalDiagnosis);
          else if (typeof payload.diagnostic_final === 'string' && payload.diagnostic_final) setFinalDiagnosis(payload.diagnostic_final);
          if (typeof payload.temperature === 'string') setVitals(v => ({ ...v, temperature: payload.temperature as string }));
          if (typeof payload.tension === 'string') setVitals(v => ({ ...v, bloodPressure: payload.tension as string }));
          if (typeof payload.pouls === 'string') setVitals(v => ({ ...v, heartRate: payload.pouls as string }));
          if (typeof payload.poids === 'string') setVitals(v => ({ ...v, weight: payload.poids as string }));
        }
      }
    );
    return () => unregisterPage();
  }, [registerPage, unregisterPage]);

  // Modals & Transfer state
  const [orderType, setOrderType] = useState<'pharmacy' | 'lab' | 'imagerie' | 'nursing' | null>(null);
  const [transferTarget, setTransferTarget] = useState('');
  // Hospitalisation après clôture (prioritaire sur le transfert)
  const [hospitalize, setHospitalize] = useState(false);

  // Dictée médicale
  const [showDictation, setShowDictation] = useState(false);
  const [dictatedSections, setDictatedSections] = useState<string[]>([]);

  /** Crée les Order réels à partir des actes dictés (tarifs = catalogue, jamais inventés). */
  const applyDictatedOrders = (orders: DictatedOrders): string[] => {
    if (!selectedPatientId || !currentUser) return [];
    const labels: string[] = [];
    const base = { patientId: selectedPatientId, status: 'pending' as const, date: new Date().toISOString(), prescribedBy: currentUser.name };

    if (orders.medications.length > 0) {
      addOrder({
        id: generateId('ORD'), type: 'pharmacy', ...base,
        details: orders.medications.map(formatMedication).join('\n'),
        fee: PRICING_CATALOG.pharmacy,
      });
      labels.push(`Ordonnance (${orders.medications.length} médicament${orders.medications.length > 1 ? 's' : ''})`);
    }
    if (orders.labTests.length > 0) {
      addOrder({
        id: generateId('ORD'), type: 'lab', ...base,
        details: `Analyses demandées :\n${orders.labTests.map(t => `- ${t}`).join('\n')}`,
        fee: PRICING_CATALOG.lab,
      });
      labels.push(`Bon biologique (${orders.labTests.length} analyse${orders.labTests.length > 1 ? 's' : ''})`);
    }
    orders.imagingExams.forEach(im => {
      addOrder({
        id: generateId('ORD'), type: 'imagerie', ...base,
        details: `Type: ${im.type}\nRégion: ${im.region ?? '-'}\nIndication Clinique: ${im.indication ?? '-'}`,
        fee: PRICING_CATALOG.imagerie,
      });
    });
    if (orders.imagingExams.length > 0) {
      labels.push(`Imagerie (${orders.imagingExams.length} examen${orders.imagingExams.length > 1 ? 's' : ''})`);
    }
    if (orders.nursingCare.length > 0) {
      addOrder({
        id: generateId('ORD'), type: 'nursing', ...base,
        details: orders.nursingCare.join('\n'),
        fee: PRICING_CATALOG.nursing,
      });
      labels.push(`Soins infirmiers (${orders.nursingCare.length})`);
    }
    return labels;
  };

  /** Applique les champs validés + crée les actes dictés (contrôle vocal total). */
  const applyDictation = (rawFields: Record<string, string>, orders: DictatedOrders) => {
    const applied: string[] = [];
    const f = { ...rawFields };

    // ── Audit F1 : orientation dictée (hospitalisation prioritaire sur transfert) ──
    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const SERVICES_DICTEE: Record<string, string> = {
      'general': 'general', 'generale': 'general', 'medecine generale': 'general',
      'cardiologie': 'cardiologie',
      'gynecologie': 'gynecologie', 'gyneco obstetrique': 'gynecologie',
      'pediatrie': 'pediatrie',
      'chirurgie': 'chirurgie',
    };
    const hospitalisation = normalize(f.hospitalisation ?? '');
    delete f.hospitalisation;
    const orientation = normalize(f.orientation ?? '');
    delete f.orientation;

    if (/^(oui|vrai|true|yes|1)/.test(hospitalisation)) {
      setHospitalize(true);
      setTransferTarget('');
      applied.push('Hospitalisation');
    } else if (orientation && SERVICES_DICTEE[orientation]) {
      const cible = SERVICES_DICTEE[orientation];
      if (cible !== selectedPatient?.targetService) {
        setTransferTarget(cible);
        applied.push(`Transfert ${cible}`);
      } // même service → ignoré (audit B4 : pas de boucle)
    }

    if (f.motif) { setChiefComplaint(f.motif); applied.push('Motif'); }

    if (f.atcd_medicaux || f.atcd_chirurgicaux || f.atcd_familiaux || f.allergies || f.mode_de_vie) {
      setHistoryCards(h => ({
        ...h,
        ...(f.atcd_medicaux ? { medical: f.atcd_medicaux } : {}),
        ...(f.atcd_chirurgicaux ? { surgical: f.atcd_chirurgicaux } : {}),
        ...(f.atcd_familiaux ? { family: f.atcd_familiaux } : {}),
        ...(f.allergies ? { allergies: f.allergies } : {}),
        ...(f.mode_de_vie ? { lifestyle: f.mode_de_vie } : {}),
      }));
      applied.push('Antécédents');
    }

    if (f.temperature || f.tension || f.pouls || f.frequence_respiratoire || f.spo2 || f.poids || f.taille) {
      setVitals(v => {
        const next = {
          ...v,
          ...(f.temperature ? { temperature: f.temperature } : {}),
          ...(f.tension ? { bloodPressure: f.tension } : {}),
          ...(f.pouls ? { heartRate: f.pouls } : {}),
          ...(f.frequence_respiratoire ? { respiratoryRate: f.frequence_respiratoire } : {}),
          ...(f.spo2 ? { o2Saturation: f.spo2 } : {}),
          ...(f.poids ? { weight: f.poids } : {}),
          ...(f.taille ? { height: f.taille } : {}),
        };
        // Bonus : IMC calculé automatiquement si poids + taille dictés
        const w = parseFloat(f.poids ?? '');
        const h = parseFloat(f.taille ?? '');
        if (!f.imc && w > 0 && h > 0) next.bmi = (w / Math.pow(h / 100, 2)).toFixed(1);
        return next;
      });
      applied.push('Constantes');
    }

    if (f.signes_generaux) { setGeneralSigns(f.signes_generaux); applied.push('Signes généraux'); }
    if (f.signes_fonctionnels) { setFunctionalSigns(f.signes_fonctionnels); applied.push('Signes fonctionnels'); }

    if (f.inspection || f.palpation || f.percussion || f.auscultation) {
      setPhysicalExam(p => ({
        ...p,
        ...(f.inspection ? { inspection: f.inspection } : {}),
        ...(f.palpation ? { palpation: f.palpation } : {}),
        ...(f.percussion ? { percussion: f.percussion } : {}),
        ...(f.auscultation ? { auscultation: f.auscultation } : {}),
      }));
      applied.push('Examen physique');
    }

    if (f.anamnese) { setAnamnese(f.anamnese); applied.push('Anamnèse'); }
    if (f.diagnostic_differentiel) { setDifferentialDiagnosis(f.diagnostic_differentiel); applied.push('Diagnostic différentiel'); }
    if (f.diagnostic_final) { setFinalDiagnosis(f.diagnostic_final); applied.push('Diagnostic final'); }

    // Actes & prescriptions issus de la même dictée
    const actes = applyDictatedOrders(orders);
    setDictatedSections([...applied, ...actes]);
  };

  // Transfert : le service courant est exclu (pas de boucle de facturation).
  const availableServices = [
    { id: '', label: 'Ne pas transférer (Clôturer le dossier)' },
    { id: 'general', label: 'Médecine Générale' },
    ...(activeModules.cardiologie && selectedPatient?.targetService !== 'cardiologie' ? [{ id: 'cardiologie', label: 'Cardiologie' }] : []),
    ...(activeModules.gynecologie && selectedPatient?.targetService !== 'gynecologie' ? [{ id: 'gynecologie', label: 'Gynécologie-Obstétrique' }] : []),
    ...(activeModules.pediatrie && selectedPatient?.targetService !== 'pediatrie' ? [{ id: 'pediatrie', label: 'Pédiatrie' }] : []),
    ...(activeModules.chirurgie && selectedPatient?.targetService !== 'chirurgie' ? [{ id: 'chirurgie', label: 'Chirurgie' }] : []),
  ];

  const [isNewConsultationEnabled, setIsNewConsultationEnabled] = useState(false);

  /**
   * Réinitialise TOUT l'état clinique du formulaire (audit R1 : aucune donnée
   * d'un patient ne doit fuiter vers un autre). Appelé à chaque changement de
   * patient sélectionné et à chaque clôture de consultation.
   */
  const resetClinicalForm = () => {
    setChiefComplaint('');
    setHistoryCards({ medical: '', surgical: '', family: '', allergies: '', lifestyle: '' });
    setGeneralSigns('');
    setFunctionalSigns('');
    setPhysicalExam({ inspection: '', palpation: '', percussion: '', auscultation: '' });
    setAnamnese('');
    setVitals({ temperature: '', bloodPressure: '', heartRate: '', respiratoryRate: '', o2Saturation: '', weight: '', height: '', bmi: '' });
    setDifferentialDiagnosis('');
    setFinalDiagnosis('');
    setTransferTarget('');
    setHospitalize(false);
    setDictatedSections([]);
    setShowDictation(false);
    setOrderType(null);
    setFormError('');
  };

  const handlePatientSelect = (id: string) => {
    // Audit R1 : purge complète avant d'ouvrir un autre dossier — impossible
    // d'hériter du texte clinique, d'un transfert ou d'une hospitalisation en cours.
    resetClinicalForm();
    setSelectedPatientId(id);
    setIsNewConsultationEnabled(false);
    const p = patients.find(patient => patient.id === id);
    if (p?.status === 'treated') {
      setActiveTab('history');
    } else {
      setActiveTab('consultation');
    }
  };

  const startNewConsultation = () => {
    setIsNewConsultationEnabled(true);
    setFormError('');
    setActiveTab('consultation');
  };

  const processCloturer = () => {
    if (!selectedPatientId || !currentUser) return;
    
    if (!finalDiagnosis) {
      setFormError("Veuillez renseigner le diagnostic retenu avant de clôturer.");
      return;
    }
    setFormError('');

    const newConsultation: Consultation = {
      id: generateId('CONS'),
      patientId: selectedPatientId,
      date: new Date().toISOString(),
      doctorId: currentUser.id,
      vitals,
      chiefComplaint,
      historyCards,
      generalSigns,
      functionalSigns,
      physicalExam,
      anamnese,
      differentialDiagnosis,
      finalDiagnosis,
      status: 'completed'
    };

    addConsultation(newConsultation);

    updatePatient(selectedPatientId, {
      // Hospitalisation prioritaire ; sinon transfert → retour à la caisse
      // (waiting_payment) pour refacturation de la consultation spécialisée —
      // fin du trou de facturation des transferts ; sinon sortie (treated).
      status: hospitalize ? 'hospitalized' : transferTarget ? 'waiting_payment' : 'treated',
      ...(transferTarget && !hospitalize ? { targetService: transferTarget, consultationFeePaid: false } : {}),
      history: [...(selectedPatient?.history || []), newConsultation.id]
    });

    // Audit R1 : purge complète du formulaire après clôture
    resetClinicalForm();
    setIsNewConsultationEnabled(false);
    setActiveTab('history');
  };

  const handleConsultation = (e: React.FormEvent) => {
    e.preventDefault();
    processCloturer();
  };

  const submitOrder = (details: string, fee: number) => {
    if (!selectedPatientId || !currentUser || !orderType) return;
    
    let generatedFee = fee;
    // If not filled, add a fake random fee
    if (!generatedFee || isNaN(generatedFee) || generatedFee <= 0) {
      generatedFee = PRICING_CATALOG[orderType as keyof typeof PRICING_CATALOG] || 0;
    }

    const newOrder: Order = {
      id: generateId('ORD'),
      patientId: selectedPatientId,
      type: orderType,
      details: details,
      fee: generatedFee,
      status: 'pending',
      date: new Date().toISOString(),
      prescribedBy: currentUser.name
    };

    addOrder(newOrder);
    setOrderType(null);
  };

  const getOrderTitle = (type: string) => {
    switch (type) {
      case 'pharmacy': return 'Ordonnance Pharmaceutique';
      case 'lab': return 'Bon de Biologie';
      case 'imagerie': return 'Bon d\'Imagerie';
      case 'nursing': return 'Bon de Soins Infirmiers';
      default: return 'Prescription';
    }
  };

  // Audit X4 : le médecin voit aussi les actes EXÉCUTÉS (confirmation de retour des services)
  const activePatientOrders = orders.filter(o => o.patientId === selectedPatientId && o.status !== undefined && ['pending', 'paid', 'completed'].includes(o.status));

  return (
    <div className="space-y-6 flex flex-col md:flex-row gap-6">
      {/* LEFT PANEL: Queue */}
      <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-blue-600" />
            File d'attente
          </h2>
          <Badge variant="outline">{myPatients.length}</Badge>
        </div>
        
        <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-140px)] pr-2">
          {myPatients.length === 0 ? (
            <div className="p-8 text-center text-slate-500 border border-dashed rounded-xl">
              Aucun patient dans votre file d'attente.
            </div>
          ) : (
            myPatients.map((p, index) => (
              <div 
                key={p.id}
                style={{ animationDelay: `${Math.min(index * 70, 560)}ms` }}
                onClick={() => handlePatientSelect(p.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePatientSelect(p.id); } }}
                tabIndex={0}
                role="button"
                aria-label={`Ouvrir le dossier de ${p.name}`}
                className={`p-4 rounded-xl border cursor-pointer transition-all animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${selectedPatientId === p.id ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500 shadow-sm' : 'border-slate-200 bg-white hover:border-blue-300 shadow-sm'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-slate-900 line-clamp-1">{p.name}</h3>
                    <p className="text-xs text-slate-500">{p.age} ans • {p.gender} • ID: {p.id}</p>
                  </div>
                  {p.status === 'hospitalized' ? (
                    <Badge variant="destructive">Hospitalisé</Badge>
                  ) : p.status === 'treated' ? (
                    <Badge variant="success">Traité</Badge>
                  ) : (
                    <Badge variant="warning">En attente</Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Active Consultation */}
      <div className="w-full md:w-2/3 lg:w-3/4">
        {selectedPatient ? (
          <Card className="h-full border-slate-200 shadow-sm flex flex-col">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 rounded-t-xl py-4 shrink-0">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
                    {selectedPatient.name.charAt(0)}
                  </div>
                  <div>
                    <CardTitle className="text-xl">{selectedPatient.name}</CardTitle>
                    <p className="text-sm text-slate-500">
                      ID: {selectedPatient.id} • {selectedPatient.age} ans • {selectedPatient.gender} • {selectedPatient.phone || 'Non renseigné'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-white">Service: <span className="capitalize ml-1">{selectedPatient.targetService}</span></Badge>
                  {selectedPatient.status === 'treated' && <Badge variant="success">Dossier Clôturé</Badge>}
                  {/* Bouton dictée TOUJOURS visible (peu importe l'onglet actif) */}
                  {selectedPatient.status !== 'treated' && (
                    <Button type="button" onClick={() => setShowDictation(true)} size="sm" className="btn-sheen bg-gradient-to-r from-indigo-600 to-violet-600 shadow-glow rounded-xl">
                      <Mic className="w-4 h-4 mr-1.5" /> Dicter
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 flex flex-col">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <div className="px-6 pt-4 border-b border-slate-100 shrink-0">
                  <TabsList className="w-full sm:w-auto grid w-full grid-cols-3">
                    <TabsTrigger value="history">Historique & Infos</TabsTrigger>
                    <TabsTrigger value="consultation" disabled={selectedPatient.status === 'treated' && !isNewConsultationEnabled}>Examen Clinique</TabsTrigger>
                    <TabsTrigger value="diagnosis" disabled={selectedPatient.status === 'treated' && !isNewConsultationEnabled}>Diagnostics & Actes</TabsTrigger>
                  </TabsList>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                  <TabsContent value="history" className="mt-0">
                     <div className="space-y-6">
                        <div>
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold flex items-center"><User className="w-5 h-5 mr-2 text-slate-500"/> Informations Complètes</h3>
                            {selectedPatient.status === 'treated' && !isNewConsultationEnabled && (
                              <Button onClick={startNewConsultation} size="sm" className="bg-blue-600 hover:bg-blue-700">
                                <Stethoscope className="w-4 h-4 mr-2" />
                                Nouvelle Consultation
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div><p className="text-xs text-slate-500">ID Patient</p><p className="font-medium">{selectedPatient.id}</p></div>
                            <div><p className="text-xs text-slate-500">Sexe</p><p className="font-medium">{selectedPatient.gender === 'F' ? 'Féminin' : 'Masculin'}</p></div>
                            <div><p className="text-xs text-slate-500">Téléphone</p><p className="font-medium">{selectedPatient.phone || '-'}</p></div>
                            <div><p className="text-xs text-slate-500">Adresse</p><p className="font-medium line-clamp-1">{selectedPatient.neighborhood ? `${selectedPatient.neighborhood}, ${selectedPatient.city}` : '-'}</p></div>
                          </div>
                        </div>

                        <div>
                        {/* Audit X2 : contexte de triage du service d'origine (transferts gynéco/pédiatrie) */}
                        {(selectedPatient.gynecoTriage || selectedPatient.pediatrieTriage) && (
                          <div className="mb-6 p-4 bg-rose-50/60 border border-rose-100 rounded-xl space-y-2">
                            <p className="text-xs font-bold uppercase tracking-widest text-rose-700">Triage à l'admission — service d'origine</p>
                            {selectedPatient.gynecoTriage && (
                              <p className="text-sm text-slate-700">
                                <strong>Gynéco :</strong> {selectedPatient.gynecoTriage.motifPrincipal} — {selectedPatient.gynecoTriage.situationObstetricale},
                                G{selectedPatient.gynecoTriage.grossessesAnterieures} P{selectedPatient.gynecoTriage.parites}
                                {selectedPatient.gynecoTriage.ageGestationnel ? `, ${selectedPatient.gynecoTriage.ageGestationnel}` : ''}
                                {selectedPatient.gynecoTriage.urgence && <span className="text-red-700 font-semibold"> ⚠ Urgence : {selectedPatient.gynecoTriage.urgenceDesc}</span>}
                              </p>
                            )}
                            {selectedPatient.pediatrieTriage && (
                              <p className="text-sm text-slate-700">
                                <strong>Pédiatrie :</strong> {selectedPatient.pediatrieTriage.motif} — {selectedPatient.pediatrieTriage.nutrition}
                                {selectedPatient.pediatrieTriage.poidsEstime ? `, ${selectedPatient.pediatrieTriage.poidsEstime} kg` : ''}
                                {selectedPatient.pediatrieTriage.urgence && <span className="text-red-700 font-semibold"> ⚠ Urgence : {selectedPatient.pediatrieTriage.urgenceDesc}</span>}
                              </p>
                            )}
                          </div>
                        )}
                          <h3 className="text-lg font-semibold mb-4 flex items-center"><ClipboardList className="w-5 h-5 mr-2 text-slate-500"/> Historique des Consultations ({selectedPatient.history?.length || 0})</h3>
                          {(!selectedPatient.history || selectedPatient.history.length === 0) ? (
                            <p className="text-slate-500 italic text-sm p-4 bg-slate-50 rounded-xl border border-dashed">Aucun historique disponible pour ce patient.</p>
                          ) : (
                            <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6">
                              {selectedPatient.history.map(consultId => {
                                const cons = consultations.find(c => c.id === consultId);
                                if (!cons) return null;
                                return (
                                  <div key={cons.id} className="relative p-5 border border-slate-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
                                    <div className="absolute -left-[35px] top-5 w-4 h-4 rounded-full bg-blue-500 border-4 border-white shadow-sm" />
                                    <div className="flex justify-between items-start pb-3 border-b border-slate-100 mb-3">
                                      <div>
                                        <div className="font-bold text-slate-800">
                                          {new Date(cons.date).toLocaleDateString()}
                                        </div>
                                        <div className="text-xs text-blue-600 font-semibold uppercase tracking-wider mt-1 flex items-center">
                                          <Activity className="w-3 h-3 mr-1" /> {cons.specialtyType || 'Consultation Générale'}
                                        </div>
                                      </div>
                                      <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full font-medium">
                                          Dr. {users.find(u => u.id === cons.doctorId)?.name || 'Consultant'}
                                      </div>
                                    </div>
                                    
                                    <div className="text-sm space-y-3">
                                      <div><span className="font-semibold text-slate-700">📌 Motif:</span> {cons.chiefComplaint || '-'}</div>
                                      <div className="grid grid-cols-4 gap-2 text-xs py-2 bg-slate-50 rounded-lg px-3 border border-slate-100">
                                        <div><span className="font-semibold text-slate-600">Temp:</span> {cons.vitals?.temperature || '-'}</div>
                                        <div><span className="font-semibold text-slate-600">TA:</span> {cons.vitals?.bloodPressure || '-'}</div>
                                        <div><span className="font-semibold text-slate-600">Pouls:</span> {cons.vitals?.heartRate || '-'}</div>
                                        <div><span className="font-semibold text-slate-600">Poids:</span> {cons.vitals?.weight || '-'}</div>
                                      </div>
                                      
                                      {cons.specialtyType && cons.specialtyData && <ConsultationSpecialtyDetails cons={cons} />}

                                      {cons.finalDiagnosis && (
                                        <div className="pt-2 border-t border-slate-50 text-indigo-700 bg-indigo-50/50 p-2 rounded-lg mt-2 font-medium">
                                          <span className="text-indigo-900">Conclusion:</span> {cons.finalDiagnosis}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }).reverse()}
                            </div>
                          )}
                        </div>
                        
                        {/* Section : Examens & Autres dossiers (composant partagé avec Gynéco/Pédiatrie) */}
                        <div>
                          <RecordsSectionTitle count={selectedPatient.medicalRecords?.length || 0} />
                          <RecordsTimeline records={selectedPatient.medicalRecords} />
                        </div>
                     </div>
                  </TabsContent>

                  <TabsContent value="consultation" className="mt-0">
                    <form id="consultation-form" onSubmit={handleConsultation} className="space-y-8">
                      {/* Dictée médicale : remplissage vocal du formulaire */}
                      <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-start">
                          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center mr-3 shrink-0">
                            <Mic className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">Contrôle vocal total</h3>
                            <p className="text-sm text-slate-600 mt-0.5">
                              Dictez l'examen <strong>et vos prescriptions</strong> (« je prescris paracétamol 1000 matin et soir 5 jours, une NFS, une échographie abdominale, un pansement quotidien… ») :
                              l'IA remplit le formulaire et crée ordonnances et bons d'examens. Vous validez tout avant application.
                            </p>
                          </div>
                        </div>
                        <Button type="button" onClick={() => setShowDictation(true)} size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-md shrink-0">
                          <Mic className="w-5 h-5 mr-2" /> Dicter l'examen
                        </Button>
                      </div>

                      {dictatedSections.length > 0 && (
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-start justify-between gap-3 animate-in fade-in duration-300">
                          <div className="flex items-start text-sm text-emerald-900">
                            <Activity className="w-5 h-5 mr-3 mt-0.5 shrink-0 text-emerald-600" />
                            <div>
                              <strong>{dictatedSections.length} section{dictatedSections.length > 1 ? 's' : ''} remplie{dictatedSections.length > 1 ? 's' : ''} par dictée</strong> : {dictatedSections.join(', ')}.
                              <span className="text-emerald-700"> Relisez et ajustez librement les champs ci-dessous avant de clôturer.</span>
                            </div>
                          </div>
                          <button onClick={() => setDictatedSections([])} className="text-emerald-400 hover:text-emerald-700 shrink-0" title="Masquer">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Motif de Consultation */}
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center text-slate-800"><AlertCircle className="w-5 h-5 mr-2 text-rose-500"/> Motif de Consultation</h3>
                        <Textarea value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} placeholder="Plainte principale du patient..." className="min-h-[60px]" />
                      </div>

                      {/* Antécédents */}
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center text-slate-800"><History className="w-5 h-5 mr-2 text-indigo-500"/> Antécédents</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Médicaux</label>
                            <Textarea value={historyCards.medical} onChange={e => setHistoryCards({...historyCards, medical: e.target.value})} placeholder="Diabète, HTA..." className="min-h-[60px]"/>
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Chirurgicaux</label>
                            <Textarea value={historyCards.surgical} onChange={e => setHistoryCards({...historyCards, surgical: e.target.value})} placeholder="Opérations passées..." className="min-h-[60px]"/>
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Familiaux</label>
                            <Textarea value={historyCards.family} onChange={e => setHistoryCards({...historyCards, family: e.target.value})} placeholder="Maladies héréditaires..." className="min-h-[60px]"/>
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Allergies & Intolérances</label>
                            <Textarea value={historyCards.allergies} onChange={e => setHistoryCards({...historyCards, allergies: e.target.value})} placeholder="Médicaments, aliments..." className="min-h-[60px]"/>
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Mode de Vie</label>
                            <Textarea value={historyCards.lifestyle} onChange={e => setHistoryCards({...historyCards, lifestyle: e.target.value})} placeholder="Tabac, alcool, sédentarité, profession..." className="min-h-[60px]"/>
                          </div>
                        </div>
                      </div>

                      {/* Constantes Vitales */}
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center text-slate-800"><HeartPulse className="w-5 h-5 mr-2 text-red-500"/> Constantes Vitales</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Température (°C)</label>
                            <Input value={vitals.temperature} onChange={e => setVitals({...vitals, temperature: e.target.value})} placeholder="ex: 37.5" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Tension (TA)</label>
                            <Input value={vitals.bloodPressure} onChange={e => setVitals({...vitals, bloodPressure: e.target.value})} placeholder="ex: 12/8" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Pouls (bpm)</label>
                            <Input value={vitals.heartRate} onChange={e => setVitals({...vitals, heartRate: e.target.value})} placeholder="ex: 80" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Fréq. Resp. (c/m)</label>
                            <Input value={vitals.respiratoryRate} onChange={e => setVitals({...vitals, respiratoryRate: e.target.value})} placeholder="ex: 16" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Sat. O2 (%)</label>
                            <Input value={vitals.o2Saturation} onChange={e => setVitals({...vitals, o2Saturation: e.target.value})} placeholder="ex: 98" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Poids (kg)</label>
                            <Input value={vitals.weight} onChange={e => setVitals({...vitals, weight: e.target.value})} placeholder="ex: 75" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Taille (cm)</label>
                            <Input value={vitals.height} onChange={e => setVitals({...vitals, height: e.target.value})} placeholder="ex: 175" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">IMC</label>
                            <Input value={vitals.bmi} onChange={e => setVitals({...vitals, bmi: e.target.value})} placeholder="ex: 24.5" />
                          </div>
                        </div>
                      </div>

                      {/* Examen Clinique */}
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center text-slate-800"><Search className="w-5 h-5 mr-2 text-blue-500"/> Examen Clinique</h3>
                        
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Signes Généraux</label>
                               <Textarea value={generalSigns} onChange={e => setGeneralSigns(e.target.value)} placeholder="État général, conscience, coloration..." className="min-h-[60px]"/>
                            </div>
                            <div>
                              <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Signes Fonctionnels</label>
                              <Textarea value={functionalSigns} onChange={e => setFunctionalSigns(e.target.value)} placeholder="Symptômes décrits par le patient selon l'appareil..." className="min-h-[60px]"/>
                            </div>
                          </div>

                          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
                            <h4 className="font-semibold text-slate-700">Signes Physiques</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Inspection</label>
                                <Textarea value={physicalExam.inspection} onChange={e => setPhysicalExam({...physicalExam, inspection: e.target.value})} placeholder="..." className="min-h-[60px]"/>
                              </div>
                              <div>
                                <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Palpation</label>
                                <Textarea value={physicalExam.palpation} onChange={e => setPhysicalExam({...physicalExam, palpation: e.target.value})} placeholder="..." className="min-h-[60px]"/>
                              </div>
                              <div>
                                <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Percussion</label>
                                <Textarea value={physicalExam.percussion} onChange={e => setPhysicalExam({...physicalExam, percussion: e.target.value})} placeholder="..." className="min-h-[60px]"/>
                              </div>
                              <div>
                                <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Auscultation</label>
                                <Textarea value={physicalExam.auscultation} onChange={e => setPhysicalExam({...physicalExam, auscultation: e.target.value})} placeholder="..." className="min-h-[60px]"/>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Remarques / Anamnèse Libre */}
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center text-slate-800"><ClipboardList className="w-5 h-5 mr-2 text-slate-500"/> Remarques Additionnelles</h3>
                        <div className="space-y-4">
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Notes / Anamnèse Libre</label>
                            <Textarea 
                              value={anamnese}
                              onChange={e => setAnamnese(e.target.value)}
                              className="min-h-[80px]"
                              placeholder="Résumé libre ou notes supplémentaires..."
                            />
                          </div>
                        </div>
                      </div>
                    </form>
                  </TabsContent>

                  <TabsContent value="diagnosis" className="mt-0">
                    <div className="space-y-8">
                      {/* Dictée depuis l'onglet Diagnostics (contrôle vocal total) */}
                      <div className="rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-start">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center mr-3 shrink-0">
                            <Mic className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-stone-900">Tout dicter — examens, diagnostics, prescriptions, transfert</h3>
                            <p className="text-sm text-stone-500 mt-0.5">
                              Dictez d'un seul coup : constantes, examen, diagnostic, ordonnances, orientation…
                            </p>
                          </div>
                        </div>
                        <Button type="button" onClick={() => setShowDictation(true)} size="lg" className="btn-sheen bg-gradient-to-r from-violet-600 to-indigo-600 shadow-glow shrink-0 rounded-xl">
                          <Mic className="w-5 h-5 mr-2" /> Dicter maintenant
                        </Button>
                      </div>
                       <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center text-slate-800"><Activity className="w-5 h-5 mr-2 text-orange-500"/> Diagnostic</h3>
                        <div className="space-y-4">
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Diagnostic Différentiel</label>
                            <Textarea 
                              value={differentialDiagnosis}
                              onChange={e => setDifferentialDiagnosis(e.target.value)}
                              placeholder="Quelles autres pathologies avez-vous envisagées ?"
                              className="min-h-[80px]"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Diagnostic Retenu <span className="text-red-500">*</span></label>
                            <Textarea 
                              required
                              form="consultation-form"
                              value={finalDiagnosis}
                              onChange={e => setFinalDiagnosis(e.target.value)}
                              placeholder="Conclusion après analyse..."
                              className="min-h-[80px] border-orange-200 focus-visible:ring-orange-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-slate-100">
                        <h3 className="text-lg font-semibold mb-4 flex items-center text-slate-800"><FileText className="w-5 h-5 mr-2 text-indigo-500"/> Prescriptions & Actes</h3>
                        <p className="text-sm text-slate-500 mb-4">Générez des ordonnances et des bons d'examens qui seront transmis automatiquement aux services concernés.</p>
                        
                        <div className="flex flex-wrap gap-3 mb-6">
                          {activeModules.pharmacie && (
                            <Button type="button" onClick={() => setOrderType('pharmacy')} variant="outline" className="text-blue-700 border-blue-200 hover:bg-blue-50">
                              <Pill className="w-4 h-4 mr-2" /> Ordonnance
                            </Button>
                          )}
                          {activeModules.laboratoire && (
                            <Button type="button" onClick={() => setOrderType('lab')} variant="outline" className="text-purple-700 border-purple-200 hover:bg-purple-50">
                              <TestTube className="w-4 h-4 mr-2" /> Bon Biologie
                            </Button>
                          )}
                          {activeModules.imagerie && (
                            <Button type="button" onClick={() => setOrderType('imagerie')} variant="outline" className="text-cyan-700 border-cyan-200 hover:bg-cyan-50">
                              <Crosshair className="w-4 h-4 mr-2" /> Bon Imagerie
                            </Button>
                          )}
                          <Button type="button" onClick={() => setOrderType('nursing')} variant="outline" className="text-rose-700 border-rose-200 hover:bg-rose-50">
                            <Syringe className="w-4 h-4 mr-2" /> Soins Infirmiers
                          </Button>
                        </div>

                        {activePatientOrders.length > 0 && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                            <h4 className="font-semibold text-slate-800 text-sm">Prescriptions générées en attente de traitement</h4>
                            <div className="space-y-2">
                              {activePatientOrders.map(o => (
                                <div key={o.id} className="flex justify-between items-center text-sm p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                                   <div className="flex flex-col">
                                     <span className="font-semibold text-slate-700">{getOrderTitle(o.type)}</span>
                                     <span className="text-slate-500 text-xs mt-0.5 line-clamp-1">{o.details}</span>
                                   </div>
                                   <div className="flex items-center space-x-3 ml-4 shrink-0">
                                     <Badge variant="outline" className="bg-slate-50">{o.fee.toLocaleString('fr-GN')} GNF</Badge>
                                     {o.status === 'pending' ? <Badge variant="warning">Non payé</Badge> : o.status === 'completed' ? <Badge variant="success">Exécuté ✓</Badge> : <Badge variant="success">Payé</Badge>}
                                   </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {formError && (
                        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm font-medium flex items-start mt-4 border border-red-200">
                           <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
                           {formError}
                        </div>
                      )}

                      <div className="pt-6 mt-6 border-t border-slate-100 space-y-4">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                          <div className="flex items-center space-x-3 w-full md:w-auto">
                            <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Orientation / Transfert :</label>
                            <select
                              className="w-full md:w-64 h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-400"
                              value={transferTarget}
                              onChange={(e) => setTransferTarget(e.target.value)}
                              disabled={hospitalize}
                            >
                              {availableServices.map(s => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                              ))}
                            </select>
                          </div>
                          <Button type="button" onClick={() => processCloturer()} size="lg" className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 shadow-md">
                            <Send className="w-4 h-4 mr-2" />
                            {hospitalize ? 'Hospitaliser & Clôturer' : transferTarget ? 'Transférer & Clôturer' : 'Clôturer la Consultation'}
                          </Button>
                        </div>
                        <label className={`flex items-center space-x-3 text-sm font-medium p-3 rounded-lg border cursor-pointer transition-colors ${hospitalize ? 'bg-indigo-50 border-indigo-300 text-indigo-900' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}>
                          <input
                            type="checkbox"
                            checked={hospitalize}
                            onChange={e => { setHospitalize(e.target.checked); if (e.target.checked) setTransferTarget(''); }}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Hospitaliser le patient après cette consultation (admission dans le service, dossier maintenu actif)</span>
                        </label>
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          <div className="h-full min-h-[500px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 bg-slate-50/50">
            <ClipboardList className="w-16 h-16 mb-4 text-slate-300" />
            <p className="text-lg font-medium text-slate-500">Sélectionnez un patient dans la file d'attente</p>
            <p className="text-sm mt-2">Son dossier médical complet s'affichera ici.</p>
          </div>
        )}
      </div>

      {/* Fullscreen Prescription Builder rendering over everything when active */}
      <PrescriptionBuilder
        type={orderType}
        onClose={() => setOrderType(null)}
        onSubmit={submitOrder}
        patientName={selectedPatient?.name || ''}
        patientAge={selectedPatient?.age?.toString() || ''}
        patientGender={selectedPatient?.gender || ''}
      />

      {/* Dictée médicale : transcription vocale → structuration IA → validation */}
      <MedicalDictation
        open={showDictation}
        onClose={() => setShowDictation(false)}
        pageName="Médecine Générale"
        schema={DICTATION_SCHEMA}
        enableOrders
        onApply={applyDictation}
      />
    </div>
  );
}
