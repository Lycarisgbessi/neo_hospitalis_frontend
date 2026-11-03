import React, { useState, useEffect } from 'react';
import { useApp, Consultation, Order, generateId, PRICING_CATALOG } from '../context/AppContext';
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
import { PatientRecordPDF } from '../components/PatientRecordPDF';
import { Clock, User, ClipboardList, Send, FileText, Pill, TestTube, Crosshair, Syringe, Activity, HeartPulse, Search, Stethoscope, Baby, Users, AlertCircle, History, Mic, X, ShieldAlert } from 'lucide-react';

/** Champs communs à toutes les consultations gynéco-obstétricales. */
const GYNECO_COMMON: Record<string, string> = {
  motif: "Motif principal de la venue",
  atcd_medicaux: "Antécédents médicaux",
  atcd_chirurgicaux: "Antécédents chirurgicaux (césarienne, myomectomie...)",
  tension: "Tension artérielle (ex: 120/80)",
  poids: "Poids en kg",
  pouls: "Pouls en bpm",
  temperature: "Température en °C",
  diagnostic_differentiel: "Diagnostics différentiels / hypothèses envisagées",
  diagnostic_final: "Diagnostic retenu / conclusion",
  // Audit F1 : orientation du patient pilotable à la voix
  orientation: "Service de transfert dicté : general (médecine générale), cardiologie, pediatrie ou chirurgie — UNIQUEMENT si explicitement dicté",
  hospitalisation: "Décision d'hospitaliser : 'oui' ou 'non' — UNIQUEMENT si explicitement dictée",
};

/** Schémas de dictée spécifiques au type d'évaluation gynéco. */
const GYNECO_SCHEMAS: Record<string, Record<string, string>> = {
  generale: { ...GYNECO_COMMON },
  gyneco: {
    ...GYNECO_COMMON,
    douleurs: "Douleurs pelviennes",
    saignements: "Saignements / pertes génitales",
    troubles_du_cycle: "Troubles du cycle",
    speculum: "Examen au spéculum",
    tv: "Toucher vaginal (TV)",
    mammaire: "Examen mammaire et frottis",
  },
  cpn: {
    ...GYNECO_COMMON,
    sa: "Âge gestationnel en semaines d'aménorrhée (SA)",
    hu: "Hauteur utérine en cm",
    bcf: "Bruits du cœur fœtal en bpm",
    maf: "Mouvements actifs du fœtus",
    presentation: "Présentation fœtale (céphalique, siège...)",
    proteines: "Protéinurie",
    oedemes: "Œdèmes",
    echo: "Compte-rendu échographique",
  },
  suivi: {
    ...GYNECO_COMMON,
    sa: "Âge gestationnel en semaines d'aménorrhée (SA)",
    hu: "Hauteur utérine en cm",
    bcf: "Bruits du cœur fœtal en bpm",
    maf: "Mouvements actifs du fœtus",
    presentation: "Présentation fœtale (céphalique, siège...)",
    proteines: "Protéinurie",
    oedemes: "Œdèmes",
    echo: "Compte-rendu échographique",
  },
  accouchement: {
    ...GYNECO_COMMON,
    dilatation: "Dilatation cervicale en cm",
    membranes: "État des membranes (intactes, rompues...)",
    mode: "Mode d'accouchement (voie basse, césarienne...)",
    date_naissance: "Date et heure de naissance",
    sexe: "Sexe du nouveau-né",
    poids_naissance: "Poids de naissance en grammes",
    apgar: "Score d'Apgar",
    delivrance: "Délivrance et suites (complications, hémorragie...)",
  },
  pf: {
    ...GYNECO_COMMON,
    desir_enfant: "Désir d'enfant / objectif de la consultante",
    methode_anterieure: "Méthodes contraceptives antérieures",
    methode_choisie: "Méthode contraceptive choisie",
  },
  postpartum: {
    ...GYNECO_COMMON,
    involution: "Involution utérine",
    lochies: "Lochies",
    cicatrice: "Cicatrice / périnée",
    allaitement: "Allaitement (exclusif, mixte...)",
  },
};

export default function GynecoPage() {
  const { patients, updatePatient, currentUser, activeModules, addConsultation, addOrder, consultations, orders, users } = useApp();
  const { registerPage, unregisterPage } = useAI();

  // ── Audit F3a : enregistrement auprès de l'assistant vocal (page muette avant) ──
  useEffect(() => {
    registerPage(
      'Gynécologie-Obstétrique',
      {
        motif: "Motif principal de la visite",
        atcd_medicaux: "Antécédents médicaux",
        tension: "Tension artérielle",
        poids: "Poids en kg",
        pouls: "Pouls en bpm",
        temperature: "Température en °C",
        diagnostic_final: "Diagnostic retenu",
        dictee: "Mettre 'oui' pour ouvrir la fenêtre de dictée médicale complète",
      },
      (action) => {
        if (action.type === 'fill_form' && action.payload) {
          const payload = action.payload as Record<string, unknown>;
          if (payload.dictee === 'oui' || payload.dictee === true) { setShowDictation(true); return; }
          if (typeof payload.motif === 'string' && payload.motif) setChiefComplaint(payload.motif);
          if (typeof payload.atcd_medicaux === 'string') setHistoryCards(h => ({ ...h, medical: payload.atcd_medicaux as string }));
          if (typeof payload.tension === 'string') setVitals(v => ({ ...v, bloodPressure: payload.tension as string }));
          if (typeof payload.poids === 'string') setVitals(v => ({ ...v, weight: payload.poids as string }));
          if (typeof payload.pouls === 'string') setVitals(v => ({ ...v, heartRate: payload.pouls as string }));
          if (typeof payload.temperature === 'string') setVitals(v => ({ ...v, temperature: payload.temperature as string }));
          if (typeof payload.diagnostic_final === 'string' && payload.diagnostic_final) setFinalDiagnosis(payload.diagnostic_final);
        }
      }
    );
    return () => unregisterPage();
  }, [registerPage, unregisterPage]);
  
  // Audit W1 : cloisonnement polyclinique — un médecin affecté à un autre service
  // (hors généralistes) ne consulte pas en gynéco ; sage-femmes et super_admin y
  // ont pleinement accès.
  const medecinHorsService =
    currentUser?.role === 'medecin' &&
    Boolean(currentUser.service) &&
    currentUser.service !== 'general' &&
    currentUser.service !== 'gynecologie';

  const myPatients = medecinHorsService ? [] : patients
    .filter(p =>
      p.targetService === 'gynecologie' &&
      p.status !== 'waiting_payment' &&
      // Consultation réglée obligatoire (transférés non payés → caisse) ;
      // les patientes traitées restent visibles pour l'historique (audit B1).
      p.consultationFeePaid
    )
    // Urgences obstétricales du triage en priorité, puis patientes actives avant
    // dossiers clôturés (audit R2), puis ordre d'arrivée
    .sort((a, b) =>
      Number(b.gynecoTriage?.urgence ?? 0) - Number(a.gynecoTriage?.urgence ?? 0) ||
      Number(a.status === 'treated') - Number(b.status === 'treated') ||
      (a.arrivalTime ?? '').localeCompare(b.arrivalTime ?? '')
    );

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // Triage Gyneco Data
  const gynecoTriage = selectedPatient?.gynecoTriage;

  const [activeTab, setActiveTab] = useState('consultation');
  const [isNewConsultationEnabled, setIsNewConsultationEnabled] = useState(false);
  const [consultType, setConsultType] = useState('generale'); // generale, gyneco, cpn, suivi, pf, accouchement, postpartum

  // Common Form State
  const [vitals, setVitals] = useState({ temperature: '', bloodPressure: '', heartRate: '', respiratoryRate: '', o2Saturation: '', weight: '', height: '', bmi: '' });
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [historyCards, setHistoryCards] = useState({ medical: '', surgical: '', family: '', allergies: '', lifestyle: '' });
  const [differentialDiagnosis, setDifferentialDiagnosis] = useState('');
  const [finalDiagnosis, setFinalDiagnosis] = useState('');
  const [formError, setFormError] = useState('');

  // Gyneco Specific State
  const [gyneco, setGyneco] = useState({ douleurs: '', saignements: '', pertes: '', demangeaisons: '', troublesCycle: '', speculum: '', tv: '', mammaire: '', frottis: '', echo: '', biopsie: '' });
  
  // CPN & Suivi State
  const [cpn, setCpn] = useState({ typeCpn: 'CPN 1', ddr: '', dpa: '', sa: '', hu: '', presentation: '', bcf: '', maf: '', oedemes: '', proteinesUrine: '', anemie: '', vaccins: '', supplementation: '', conseils: '', echo: '' });
  
  // Accouchement State
  const [accouchement, setAccouchement] = useState({ dateAdmission: '', motif: '', membranes: '', dilatation: '', hauteur: '', contractions: '', bcfInitial: '', mode: '', dateNaissance: '', sexe: '', poidsNouveauNe: '', apgar: '', delivrance: '', soins: '' });
  
  // PF State
  const [pf, setPf] = useState({ desirDEnfant: '', methodeAnterieure: '', methodeChoisie: '', prescriptions: '' });
  
  // Post-Partum State
  const [postpartum, setPostpartum] = useState({ involution: '', lochies: '', cicatrice: '', perinee: '', allaitement: '', contraception: '' });

  // Modals & Transfer state
  const [orderType, setOrderType] = useState<'pharmacy' | 'lab' | 'imagerie' | 'nursing' | null>(null);
  const [transferTarget, setTransferTarget] = useState('');
  // Hospitalisation après clôture (prioritaire sur le transfert)
  const [hospitalize, setHospitalize] = useState(false);

  // Dictée médicical
  const [showDictation, setShowDictation] = useState(false);
  const [showPDFExport, setShowPDFExport] = useState(false);
  const [dictatedSections, setDictatedSections] = useState<string[]>([]);
  const dictationSchema = GYNECO_SCHEMAS[consultType] ?? GYNECO_COMMON;

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
      }
    }

    if (f.motif) { setChiefComplaint(f.motif); applied.push('Motif'); }

    if (f.atcd_medicaux || f.atcd_chirurgicaux) {
      setHistoryCards(h => ({
        ...h,
        ...(f.atcd_medicaux ? { medical: f.atcd_medicaux } : {}),
        ...(f.atcd_chirurgicaux ? { surgical: f.atcd_chirurgicaux } : {}),
      }));
      applied.push('Antécédents');
    }

    if (f.tension || f.poids || f.pouls || f.temperature) {
      setVitals(v => ({
        ...v,
        ...(f.tension ? { bloodPressure: f.tension } : {}),
        ...(f.poids ? { weight: f.poids } : {}),
        ...(f.pouls ? { heartRate: f.pouls } : {}),
        ...(f.temperature ? { temperature: f.temperature } : {}),
      }));
      applied.push('Constantes');
    }

    if (consultType === 'gyneco' && (f.douleurs || f.saignements || f.troubles_du_cycle || f.speculum || f.tv || f.mammaire)) {
      setGyneco(g => ({
        ...g,
        ...(f.douleurs ? { douleurs: f.douleurs } : {}),
        ...(f.saignements ? { saignements: f.saignements } : {}),
        ...(f.troubles_du_cycle ? { troublesCycle: f.troubles_du_cycle } : {}),
        ...(f.speculum ? { speculum: f.speculum } : {}),
        ...(f.tv ? { tv: f.tv } : {}),
        ...(f.mammaire ? { mammaire: f.mammaire } : {}),
      }));
      applied.push('Examen gynéco');
    }

    if ((consultType === 'cpn' || consultType === 'suivi') && (f.sa || f.hu || f.bcf || f.maf || f.presentation || f.proteines || f.oedemes || f.echo)) {
      setCpn(c => ({
        ...c,
        ...(f.sa ? { sa: f.sa } : {}),
        ...(f.hu ? { hu: f.hu } : {}),
        ...(f.bcf ? { bcf: f.bcf } : {}),
        ...(f.maf ? { maf: f.maf } : {}),
        ...(f.presentation ? { presentation: f.presentation } : {}),
        ...(f.proteines ? { proteinesUrine: f.proteines } : {}),
        ...(f.oedemes ? { oedemes: f.oedemes } : {}),
        ...(f.echo ? { echo: f.echo } : {}),
      }));
      applied.push('Suivi de grossesse');
    }

    if (consultType === 'accouchement' && (f.dilatation || f.membranes || f.mode || f.date_naissance || f.sexe || f.poids_naissance || f.apgar || f.delivrance)) {
      setAccouchement(a => ({
        ...a,
        ...(f.dilatation ? { dilatation: f.dilatation } : {}),
        ...(f.membranes ? { membranes: f.membranes } : {}),
        ...(f.mode ? { mode: f.mode } : {}),
        ...(f.date_naissance ? { dateNaissance: f.date_naissance } : {}),
        ...(f.sexe ? { sexe: f.sexe } : {}),
        ...(f.poids_naissance ? { poidsNouveauNe: f.poids_naissance } : {}),
        ...(f.apgar ? { apgar: f.apgar } : {}),
        ...(f.delivrance ? { delivrance: f.delivrance } : {}),
      }));
      applied.push('Accouchement');
    }

    if (consultType === 'pf' && (f.desir_enfant || f.methode_anterieure || f.methode_choisie)) {
      setPf(p => ({
        ...p,
        ...(f.desir_enfant ? { desirDEnfant: f.desir_enfant } : {}),
        ...(f.methode_anterieure ? { methodeAnterieure: f.methode_anterieure } : {}),
        ...(f.methode_choisie ? { methodeChoisie: f.methode_choisie } : {}),
      }));
      applied.push('Planification familiale');
    }

    if (consultType === 'postpartum' && (f.involution || f.lochies || f.cicatrice || f.allaitement)) {
      setPostpartum(p => ({
        ...p,
        ...(f.involution ? { involution: f.involution } : {}),
        ...(f.lochies ? { lochies: f.lochies } : {}),
        ...(f.cicatrice ? { cicatrice: f.cicatrice } : {}),
        ...(f.allaitement ? { allaitement: f.allaitement } : {}),
      }));
      applied.push('Post-partum');
    }

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
    ...(activeModules.pediatrie && selectedPatient?.targetService !== 'pediatrie' ? [{ id: 'pediatrie', label: 'Pédiatrie' }] : []),
    ...(activeModules.chirurgie && selectedPatient?.targetService !== 'chirurgie' ? [{ id: 'chirurgie', label: 'Chirurgie' }] : []),
  ];

  const handlePatientSelect = (id: string) => {
    // Audit R1 : purge complète avant d'ouvrir un autre dossier
    resetForms();
    setSelectedPatientId(id);
    setIsNewConsultationEnabled(false);
    const p = patients.find(patient => patient.id === id);
    if (p?.status === 'treated') {
      setActiveTab('history');
    } else {
      setActiveTab('consultation');
      // Pre-fill chief complaint with triage data
      if (p?.gynecoTriage?.motifPrincipal) {
        setChiefComplaint(p.gynecoTriage.motifPrincipal);
      }
    }
  };

  const startNewConsultation = () => {
    setIsNewConsultationEnabled(true);
    setActiveTab('consultation');
  };

  const processCloturer = () => {
    if (!selectedPatientId || !currentUser) return;

    // Audit Y3 : validation inline (plus d'alert() bloquant, cohérent avec DoctorPage)
    if (!finalDiagnosis.trim()) {
      setFormError("Veuillez renseigner le diagnostic retenu avant de clôturer.");
      return;
    }
    setFormError('');

    let specialtyData: Record<string, unknown> = {};
    if (consultType === 'gyneco') specialtyData = gyneco;
    else if (consultType === 'cpn' || consultType === 'suivi') specialtyData = cpn;
    else if (consultType === 'accouchement') specialtyData = accouchement;
    else if (consultType === 'pf') specialtyData = pf;
    else if (consultType === 'postpartum') specialtyData = postpartum;

    const newConsultation: Consultation = {
      id: generateId('CONS-GYN'),
      patientId: selectedPatientId,
      date: new Date().toISOString(),
      doctorId: currentUser.id,
      vitals,
      chiefComplaint,
      historyCards,
      generalSigns: '',
      functionalSigns: '',
      physicalExam: { inspection: '', palpation: '', percussion: '', auscultation: '' },
      anamnese: '',
      differentialDiagnosis,
      finalDiagnosis,
      status: 'completed',
      specialtyType: consultType,
      specialtyData
    };

    addConsultation(newConsultation);
    
    updatePatient(selectedPatientId, {
      // Hospitalisation prioritaire ; sinon transfert → retour à la caisse
      // (waiting_payment) pour refacturation ; sinon sortie (treated).
      status: hospitalize ? 'hospitalized' : transferTarget ? 'waiting_payment' : 'treated',
      ...(transferTarget && !hospitalize ? { targetService: transferTarget, consultationFeePaid: false } : {}),
      history: [...(selectedPatient?.history || []), newConsultation.id]
    });

    setHospitalize(false);
    
    resetForms();
    setIsNewConsultationEnabled(false);
    setActiveTab('history');
  };

  const resetForms = () => {
    setVitals({ temperature: '', bloodPressure: '', heartRate: '', respiratoryRate: '', o2Saturation: '', weight: '', height: '', bmi: '' });
    setChiefComplaint('');
    setHistoryCards({ medical: '', surgical: '', family: '', allergies: '', lifestyle: '' });
    setDifferentialDiagnosis('');
    setFinalDiagnosis('');
    setGyneco({ douleurs: '', saignements: '', pertes: '', demangeaisons: '', troublesCycle: '', speculum: '', tv: '', mammaire: '', frottis: '', echo: '', biopsie: '' });
    setCpn({ typeCpn: 'CPN 1', ddr: '', dpa: '', sa: '', hu: '', presentation: '', bcf: '', maf: '', oedemes: '', proteinesUrine: '', anemie: '', vaccins: '', supplementation: '', conseils: '', echo: '' });
    setAccouchement({ dateAdmission: '', motif: '', membranes: '', dilatation: '', hauteur: '', contractions: '', bcfInitial: '', mode: '', dateNaissance: '', sexe: '', poidsNouveauNe: '', apgar: '', delivrance: '', soins: '' });
    setPf({ desirDEnfant: '', methodeAnterieure: '', methodeChoisie: '', prescriptions: '' });
    setPostpartum({ involution: '', lochies: '', cicatrice: '', perinee: '', allaitement: '', contraception: '' });
    // Audit R1 : purge également orientation/hospitalisation/dictée pour
    // qu'aucune décision d'un patient ne se reporte sur un autre.
    setTransferTarget('');
    setHospitalize(false);
    setDictatedSections([]);
    setShowDictation(false);
    setOrderType(null);
    setConsultType('generale');
    setFormError('');
  };

  const submitOrder = (details: string, fee: number) => {
    if (!selectedPatientId || !currentUser || !orderType) return;
    
    // Si aucun tarif n'est saisi, on applique le tarif officiel du catalogue
    // (plus jamais de montant aléatoire inventé par le système).
    const generatedFee = (!fee || isNaN(fee) || fee <= 0)
      ? (PRICING_CATALOG[orderType as keyof typeof PRICING_CATALOG] ?? 0)
      : fee;

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
      case 'pharmacy': return 'Ordonnance';
      case 'lab': return 'Examens Biologiques';
      case 'imagerie': return 'Imagerie / Échographie';
      case 'nursing': return 'Soins Infirmiers';
      default: return 'Prescription';
    }
  };

  // Audit X4 : la sage-femme/le médecin voit aussi les actes EXÉCUTÉS
  const activePatientOrders = orders.filter(o => o.patientId === selectedPatientId && ['pending', 'paid', 'completed'].includes(o.status));

  const renderHistoryDetails = (cons: Consultation) => (
    // Audit X1 : rendu partagé — lisible depuis toutes les pages de consultation
    <ConsultationSpecialtyDetails cons={cons} />
  );

  const consultTypes = [
    { id: 'generale', label: 'Consultation Générale' },
    { id: 'gyneco', label: 'Gynécologique' },
    { id: 'cpn', label: 'Consul. Prénatale (CPN)' },
    { id: 'suivi', label: 'Suivi de Grossesse' },
    { id: 'accouchement', label: 'Accouchement' },
    { id: 'postpartum', label: 'Post-Partum' },
    { id: 'pf', label: 'Planification Familiale' }
  ];

  return (
    <div className="space-y-6 flex flex-col md:flex-row gap-6">
      <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-rose-600" />
            File Gynécologie
          </h2>
          <Badge variant="outline">{myPatients.length}</Badge>
        </div>
        
        <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-140px)] pr-2">
          {medecinHorsService ? (
            <div className="p-8 text-center border border-amber-200 bg-amber-50 rounded-xl space-y-2">
              <ShieldAlert className="w-10 h-10 mx-auto text-amber-500" />
              <p className="font-semibold text-amber-900">Consultation réservée au service Gynécologie-Obstétrique</p>
              <p className="text-sm text-amber-800">
                Vous êtes affecté au service « {currentUser?.service} » — en mode polyclinique cloisonnée,
                ce module est accessible aux praticiens de gynécologie, aux sage-femmes et au super administrateur.
              </p>
            </div>
          ) : myPatients.length === 0 ? (
            <div className="p-8 text-center text-slate-500 border border-dashed rounded-xl">
              Aucune patiente en attente.
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
                className={`p-4 rounded-xl border cursor-pointer transition-all animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 ${selectedPatientId === p.id ? 'border-rose-500 bg-rose-50 ring-1 ring-rose-500 shadow-sm' : 'border-slate-200 bg-white hover:border-rose-300 shadow-sm'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-slate-900 line-clamp-1">{p.name}</h3>
                    <p className="text-xs text-slate-500">{p.age} ans • {p.gender} • ID: {p.id}</p>
                  </div>
                  {p.status === 'hospitalized' ? (
                    <Badge variant="destructive">Hospitalisée</Badge>
                  ) : p.status === 'treated' ? (
                    <Badge variant="success">Traitée</Badge>
                  ) : (
                    <Badge variant="warning">En attente</Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="w-full md:w-2/3 lg:w-3/4">
        {selectedPatient ? (
          <Card className="h-full border-slate-200 shadow-sm flex flex-col">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 rounded-t-xl py-4 shrink-0">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-lg">
                    {selectedPatient.name.charAt(0)}
                  </div>
                  <div>
                    <CardTitle className="text-xl">{selectedPatient.name}</CardTitle>
                    <p className="text-sm text-slate-500">
                      ID: {selectedPatient.id} • {selectedPatient.age} ans • Tél: {selectedPatient.phone || 'Non renseigné'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-white text-rose-700 border-rose-200">Gynécologie/Obstétrique</Badge>
                  {selectedPatient.status === 'treated' && <Badge variant="success">Dossier Clôturé</Badge>}
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
                    <TabsTrigger value="history">Historique & Triage</TabsTrigger>
                    <TabsTrigger value="consultation" disabled={selectedPatient.status === 'treated' && !isNewConsultationEnabled}>Examen Clinique</TabsTrigger>
                    <TabsTrigger value="diagnosis" disabled={selectedPatient.status === 'treated' && !isNewConsultationEnabled}>Diagnostics & Actes</TabsTrigger>
                  </TabsList>
                </div>

                <div className="p-6 overflow-y-auto flex-1 h-[calc(100vh-280px)]">
                  <TabsContent value="history" className="mt-0 space-y-6">
                    {gynecoTriage && (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-rose-50 rounded-xl border border-rose-100 relative">
                        <div className="md:col-span-4 pb-2 border-b border-rose-100 font-semibold text-rose-800 flex items-center">
                           <Activity className="w-4 h-4 mr-2" /> Triage Réception
                        </div>
                        <div><p className="text-xs text-rose-500 uppercase tracking-wider font-bold">Motif</p><p className="font-medium text-slate-800">{gynecoTriage.motifPrincipal}</p></div>
                        <div><p className="text-xs text-rose-500 uppercase tracking-wider font-bold">Situation</p><p className="font-medium text-slate-800">{gynecoTriage.situationObstetricale}</p></div>
                        <div><p className="text-xs text-rose-500 uppercase tracking-wider font-bold">Gravida/Para</p><p className="font-medium text-slate-800">G{gynecoTriage.grossessesAnterieures} P{gynecoTriage.parites}</p></div>
                        <div><p className="text-xs text-rose-500 uppercase tracking-wider font-bold">Age Gestationnel</p><p className="font-medium text-slate-800">{gynecoTriage.ageGestationnel || '-'}</p></div>
                        {gynecoTriage.urgence && (
                          <div className="md:col-span-4 mt-2 p-3 bg-red-100 text-red-800 border border-red-200 rounded-lg text-sm font-semibold flex items-center">
                            <AlertCircle className="w-4 h-4 mr-2" /> Urgence Signalée : {gynecoTriage.urgenceDesc}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold flex items-center"><History className="w-5 h-5 mr-2 text-slate-500"/> Historique Gynéco-Obstétrical</h3>
                      {selectedPatient.status === 'treated' && !isNewConsultationEnabled && (
                        <Button onClick={startNewConsultation} size="sm" className="bg-rose-600 hover:bg-rose-700">
                          <Stethoscope className="w-4 h-4 mr-2" />
                          Nouvelle Consultation
                        </Button>
                      )}
                    </div>

                    {(!selectedPatient.history || selectedPatient.history.length === 0) ? (
                      <p className="text-slate-500 italic text-sm p-4 bg-slate-50 rounded-xl border border-dashed">Aucun historique disponible pour ce patient.</p>
                    ) : (
                      <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6">
                        {selectedPatient.history.map((consultId, idx) => {
                          const cons = consultations.find(c => c.id === consultId);
                          if (!cons) return null;
                          return (
                            <div key={cons.id} className="relative p-5 border border-slate-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
                              <div className="absolute -left-[35px] top-5 w-4 h-4 rounded-full bg-rose-500 border-4 border-white shadow-sm" />
                              <div className="flex justify-between items-start pb-3 border-b border-slate-100 mb-3">
                                <div>
                                  <div className="font-bold text-slate-800">
                                    {new Date(cons.date).toLocaleDateString()}
                                  </div>
                                  <div className="text-xs text-rose-600 font-semibold uppercase tracking-wider mt-1 flex items-center">
                                    <Activity className="w-3 h-3 mr-1" /> {cons.specialtyType || 'Consultation'}
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
                                {renderHistoryDetails(cons)}
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

                    {/* Dossier longitudinal : résultats labo, imagerie, soins (audit B2) */}
                    <div>
                      <RecordsSectionTitle count={selectedPatient.medicalRecords?.length || 0} />
                      <RecordsTimeline records={selectedPatient.medicalRecords} />
                    </div>
                  </TabsContent>

                  <TabsContent value="consultation" className="mt-0 space-y-8">
                    <form id="consultation-form" onSubmit={(e) => { e.preventDefault(); processCloturer(); }} className="space-y-8">
                      {/* Dictée médicale : remplissage vocal du formulaire */}
                      <div className="rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/50 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-start">
                          <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center mr-3 shrink-0">
                            <Mic className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">Dictez votre examen</h3>
                            <p className="text-sm text-slate-600 mt-0.5">
                              Parlez librement : l'IA transcrit et remplit les champs du formulaire pour vous.
                              Vous validez avant application.
                            </p>
                          </div>
                        </div>
                        <Button type="button" onClick={() => setShowDictation(true)} size="lg" className="bg-rose-600 hover:bg-rose-700 shadow-md shrink-0">
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
                      
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <label className="text-sm font-semibold text-slate-800 mb-3 block">Type d'Évaluation <span className="text-rose-500">*</span></label>
                        <div className="flex flex-wrap gap-2">
                          {consultTypes.map(type => (
                            <button
                              key={type.id}
                              type="button"
                              onClick={() => setConsultType(type.id)}
                              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                consultType === type.id 
                                  ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-200 ring-offset-2' 
                                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {type.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* LEFT COLUMN: BASE INFO */}
                        <div className="space-y-8 border-r border-slate-100 pr-0 lg:pr-8">
                          <div>
                            <h3 className="text-md font-semibold mb-4 flex items-center text-slate-800"><AlertCircle className="w-5 h-5 mr-2 text-slate-400"/> Motif et Antécédents</h3>
                            <div className="space-y-4">
                              <div>
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Motif Principal</label>
                                <Input value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} placeholder="Raison de la venue..." className="bg-white" />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">ATCD Médicaux</label>
                                  <Textarea value={historyCards.medical} onChange={e => setHistoryCards({...historyCards, medical: e.target.value})} placeholder="Diabète, HTA..." className="min-h-[60px] bg-white"/>
                                </div>
                                <div>
                                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">ATCD Chirurgicaux</label>
                                  <Textarea value={historyCards.surgical} onChange={e => setHistoryCards({...historyCards, surgical: e.target.value})} placeholder="Césarienne, myomectomie..." className="min-h-[60px] bg-white"/>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-md font-semibold mb-4 flex items-center text-slate-800"><HeartPulse className="w-5 h-5 mr-2 text-slate-400"/> Constantes Vitales</h3>
                            <div className="grid grid-cols-2 gap-3">
                              <div><label className="text-xs font-semibold text-slate-500 block mb-1">Tension (TA)</label><Input value={vitals.bloodPressure} onChange={e => setVitals({...vitals, bloodPressure: e.target.value})} placeholder="ex: 120/80" className="bg-white h-9"/></div>
                              <div><label className="text-xs font-semibold text-slate-500 block mb-1">Poids (kg)</label><Input value={vitals.weight} onChange={e => setVitals({...vitals, weight: e.target.value})} placeholder="ex: 65" className="bg-white h-9"/></div>
                              <div><label className="text-xs font-semibold text-slate-500 block mb-1">Pouls (bpm)</label><Input value={vitals.heartRate} onChange={e => setVitals({...vitals, heartRate: e.target.value})} placeholder="ex: 80" className="bg-white h-9"/></div>
                              <div><label className="text-xs font-semibold text-slate-500 block mb-1">Temp. (°C)</label><Input value={vitals.temperature} onChange={e => setVitals({...vitals, temperature: e.target.value})} placeholder="ex: 37.2" className="bg-white h-9"/></div>
                            </div>
                          </div>
                        </div>

                        {/* RIGHT COLUMN: DYNAMIC SPECIALTY FIELDS */}
                        <div className="space-y-8">
                          
                          {consultType === 'generale' && (
                            <div className="bg-white p-6 rounded-xl border border-slate-200">
                               <h3 className="text-md font-semibold mb-4 flex items-center text-slate-800">Consultation Générale</h3>
                               <p className="text-sm text-slate-500 mb-4">Utilisez ce module pour documenter une évaluation générale avant d'orienter vers une prise en charge spécifique si nécessaire.</p>
                               <div className="space-y-4">
                                  <div>
                                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Examen Physique Général</label>
                                    <Textarea placeholder="Inspection, palpation, auscultation..." className="min-h-[120px]" />
                                  </div>
                               </div>
                            </div>
                          )}

                          {consultType === 'gyneco' && (
                            <div className="bg-rose-50/50 p-6 rounded-xl border border-rose-100 space-y-4">
                               <h3 className="text-md font-semibold mb-4 flex items-center text-rose-800"><User className="w-5 h-5 mr-2"/>Gynécologie</h3>
                               <div className="grid grid-cols-2 gap-4">
                                  <div><label className="text-xs font-semibold text-slate-500 block mb-1">Douleurs pelviennes</label><Input value={gyneco.douleurs} onChange={e=>setGyneco({...gyneco, douleurs: e.target.value})} className="bg-white"/></div>
                                  <div><label className="text-xs font-semibold text-slate-500 block mb-1">Saignements/Pertes</label><Input value={gyneco.saignements} onChange={e=>setGyneco({...gyneco, saignements: e.target.value})} className="bg-white"/></div>
                               </div>
                               <div><label className="text-xs font-semibold text-slate-500 block mb-1">Troubles du cycle</label><Input value={gyneco.troublesCycle} onChange={e=>setGyneco({...gyneco, troublesCycle: e.target.value})} className="bg-white"/></div>
                               
                               <div className="pt-2 border-t border-rose-100">
                                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Examen Gynécologique</h4>
                                  <div className="space-y-3">
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Examen au Spéculum</label><Textarea value={gyneco.speculum} onChange={e=>setGyneco({...gyneco, speculum: e.target.value})} className="min-h-[60px] bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Toucher Vaginal (TV)</label><Textarea value={gyneco.tv} onChange={e=>setGyneco({...gyneco, tv: e.target.value})} className="min-h-[60px] bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Examen Mammaire & Frottis</label><Textarea value={gyneco.mammaire} onChange={e=>setGyneco({...gyneco, mammaire: e.target.value})} className="min-h-[60px] bg-white"/></div>
                                  </div>
                               </div>
                            </div>
                          )}

                          {(consultType === 'cpn' || consultType === 'suivi') && (
                            <div className="bg-purple-50/50 p-6 rounded-xl border border-purple-100 space-y-4">
                               <h3 className="text-md font-semibold mb-4 flex items-center text-purple-800"><Baby className="w-5 h-5 mr-2"/>{consultType === 'cpn' ? 'Consultation Prénatale' : 'Suivi de Grossesse'}</h3>
                               
                               {consultType === 'cpn' && (
                                 <select className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-sm mb-2" value={cpn.typeCpn} onChange={e=>setCpn({...cpn, typeCpn: e.target.value})}>
                                    <option>CPN 1 (avant 12 SA)</option><option>CPN 2 (16-24 SA)</option><option>CPN 3 (28-32 SA)</option><option>CPN 4 (34-36 SA)</option><option>CPN Supplémentaire</option>
                                 </select>
                               )}

                               <div className="grid grid-cols-2 gap-3">
                                  <div><label className="text-xs font-semibold text-slate-500 block mb-1">DDR</label><Input type="date" value={cpn.ddr} onChange={e=>setCpn({...cpn, ddr: e.target.value})} className="bg-white"/></div>
                                  <div><label className="text-xs font-semibold text-slate-500 block mb-1">SA Actuel</label><Input value={cpn.sa} onChange={e=>setCpn({...cpn, sa: e.target.value})} placeholder="ex: 24 SA" className="bg-white"/></div>
                               </div>

                               <div className="grid grid-cols-3 gap-3">
                                  <div><label className="text-xs font-semibold text-slate-500 block mb-1">HA (cm)</label><Input value={cpn.hu} onChange={e=>setCpn({...cpn, hu: e.target.value})} className="bg-white"/></div>
                                  <div><label className="text-xs font-semibold text-slate-500 block mb-1">BCF (bpm)</label><Input value={cpn.bcf} onChange={e=>setCpn({...cpn, bcf: e.target.value})} className="bg-white"/></div>
                                  <div><label className="text-xs font-semibold text-slate-500 block mb-1">MAF</label><Input value={cpn.maf} onChange={e=>setCpn({...cpn, maf: e.target.value})} placeholder="Présent" className="bg-white"/></div>
                               </div>

                               <div><label className="text-xs font-semibold text-slate-500 block mb-1">Présentation fœtale</label><Input value={cpn.presentation} onChange={e=>setCpn({...cpn, presentation: e.target.value})} placeholder="Céphalique..." className="bg-white"/></div>

                               <div className="pt-2 border-t border-purple-100">
                                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Dépistage & Bilan</h4>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Protéinurie</label><Input value={cpn.proteinesUrine} onChange={e=>setCpn({...cpn, proteinesUrine: e.target.value})} className="bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Œdèmes</label><Input value={cpn.oedemes} onChange={e=>setCpn({...cpn, oedemes: e.target.value})} className="bg-white"/></div>
                                  </div>
                                  <div className="mt-3"><label className="text-xs font-semibold text-slate-500 block mb-1">Compte-rendu Écho</label><Textarea value={cpn.echo} onChange={e=>setCpn({...cpn, echo: e.target.value})} className="min-h-[60px] bg-white"/></div>
                               </div>
                            </div>
                          )}

                          {consultType === 'accouchement' && (
                            <div className="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100 space-y-4">
                               <h3 className="text-md font-semibold mb-4 flex items-center text-indigo-800"><Activity className="w-5 h-5 mr-2"/>Accouchement / Partogramme</h3>
                               
                               <div className="grid grid-cols-2 gap-3">
                                  <div><label className="text-xs font-semibold text-slate-500 block mb-1">Dilatation (cm)</label><Input type="number" value={accouchement.dilatation} onChange={e=>setAccouchement({...accouchement, dilatation: e.target.value})} className="bg-white"/></div>
                                  <div><label className="text-xs font-semibold text-slate-500 block mb-1">Membranes</label>
                                    <select className="w-full h-9 rounded-md border border-slate-300 bg-white px-2 text-sm" value={accouchement.membranes} onChange={e=>setAccouchement({...accouchement, membranes: e.target.value})}>
                                      <option></option><option>Intactes</option><option>Rompues (Clair)</option><option>Rompues (Méconial)</option>
                                    </select>
                                  </div>
                               </div>
                               
                               <div className="grid grid-cols-2 gap-3">
                                  <div><label className="text-xs font-semibold text-slate-500 block mb-1">Mode d'Accouch.</label>
                                    <select className="w-full h-9 rounded-md border border-slate-300 bg-white px-2 text-sm" value={accouchement.mode} onChange={e=>setAccouchement({...accouchement, mode: e.target.value})}>
                                      <option></option><option>Voie Basse Spontanée</option><option>Instrumentale</option><option>Césarienne</option>
                                    </select>
                                  </div>
                                  <div><label className="text-xs font-semibold text-slate-500 block mb-1">Date/Heure Naissance</label><Input type="datetime-local" value={accouchement.dateNaissance} onChange={e=>setAccouchement({...accouchement, dateNaissance: e.target.value})} className="bg-white text-sm"/></div>
                               </div>

                               <div className="grid grid-cols-3 gap-3">
                                  <div><label className="text-xs font-semibold text-slate-500 block mb-1">Sexe</label><Input value={accouchement.sexe} onChange={e=>setAccouchement({...accouchement, sexe: e.target.value})} className="bg-white"/></div>
                                  <div><label className="text-xs font-semibold text-slate-500 block mb-1">Poids (g)</label><Input value={accouchement.poidsNouveauNe} onChange={e=>setAccouchement({...accouchement, poidsNouveauNe: e.target.value})} className="bg-white"/></div>
                                  <div><label className="text-xs font-semibold text-slate-500 block mb-1">Apgar</label><Input value={accouchement.apgar} onChange={e=>setAccouchement({...accouchement, apgar: e.target.value})} placeholder="ex: 9/10" className="bg-white"/></div>
                               </div>

                               <div><label className="text-xs font-semibold text-slate-500 block mb-1">Délivrance / Suites</label><Textarea value={accouchement.delivrance} onChange={e=>setAccouchement({...accouchement, delivrance: e.target.value})} placeholder="Complication, hémorragie..." className="min-h-[60px] bg-white"/></div>
                            </div>
                          )}

                          {consultType === 'pf' && (
                            <div className="bg-teal-50/50 p-6 rounded-xl border border-teal-100 space-y-4">
                               <h3 className="text-md font-semibold mb-4 flex items-center text-teal-800"><Users className="w-5 h-5 mr-2"/>Planification Familiale</h3>
                               <div><label className="text-xs font-semibold text-slate-500 block mb-1">Désir d'enfant / Objectif</label><Input value={pf.desirDEnfant} onChange={e=>setPf({...pf, desirDEnfant: e.target.value})} className="bg-white"/></div>
                               <div><label className="text-xs font-semibold text-slate-500 block mb-1">Méthodes antérieures</label><Input value={pf.methodeAnterieure} onChange={e=>setPf({...pf, methodeAnterieure: e.target.value})} className="bg-white"/></div>
                               <div><label className="text-xs font-semibold text-slate-500 block mb-1">Méthode Choisie</label>
                                  <select className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-sm" value={pf.methodeChoisie} onChange={e=>setPf({...pf, methodeChoisie: e.target.value})}>
                                    <option></option><option>Pilule orale combinée</option><option>Micropilule progestative</option><option>Injectable (DMPA)</option><option>Implant</option><option>DIU Cuivre</option><option>DIU Hormonal</option><option>Préservatif</option>
                                  </select>
                               </div>
                            </div>
                          )}

                          {consultType === 'postpartum' && (
                            <div className="bg-orange-50/50 p-6 rounded-xl border border-orange-100 space-y-4">
                               <h3 className="text-md font-semibold mb-4 flex items-center text-orange-800"><User className="w-5 h-5 mr-2"/>Suivi Post-Partum</h3>
                               <div className="grid grid-cols-2 gap-3">
                                  <div><label className="text-xs font-semibold text-slate-500 block mb-1">Involution Utérine</label><Input value={postpartum.involution} onChange={e=>setPostpartum({...postpartum, involution: e.target.value})} className="bg-white"/></div>
                                  <div><label className="text-xs font-semibold text-slate-500 block mb-1">Lochies</label><Input value={postpartum.lochies} onChange={e=>setPostpartum({...postpartum, lochies: e.target.value})} className="bg-white"/></div>
                               </div>
                               <div className="grid grid-cols-2 gap-3">
                                  <div><label className="text-xs font-semibold text-slate-500 block mb-1">Cicatrice / Périnée</label><Input value={postpartum.cicatrice} onChange={e=>setPostpartum({...postpartum, cicatrice: e.target.value})} className="bg-white"/></div>
                                  <div><label className="text-xs font-semibold text-slate-500 block mb-1">Allaitement</label><Input value={postpartum.allaitement} onChange={e=>setPostpartum({...postpartum, allaitement: e.target.value})} placeholder="Exclusif / Mixte..." className="bg-white"/></div>
                               </div>
                            </div>
                          )}

                        </div>
                      </div>
                    </form>
                  </TabsContent>

                  <TabsContent value="diagnosis" className="mt-0">
                    {/* Dictée depuis Diagnostics (contrôle vocal total) */}
                    <div className="rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/40 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
                      <div className="flex items-start">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-violet-600 text-white flex items-center justify-center mr-3 shrink-0">
                          <Mic className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-stone-900">Tout dicter — diagnostics, prescriptions, transfert</h3>
                          <p className="text-sm text-stone-500 mt-0.5">
                            Dictez d'un seul coup : examen, diagnostic, ordonnances, hospitalisation, orientation…
                          </p>
                        </div>
                      </div>
                      <Button type="button" onClick={() => setShowDictation(true)} size="lg" className="btn-sheen bg-gradient-to-r from-rose-600 to-violet-600 shadow-glow shrink-0 rounded-xl">
                        <Mic className="w-5 h-5 mr-2" /> Dicter maintenant
                      </Button>
                    </div>
                    <div className="space-y-8">
                       <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center text-slate-800"><Activity className="w-5 h-5 mr-2 text-orange-500"/> Diagnostics et Conclusions</h3>
                        <div className="space-y-4">
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Diagnostic Différentiel / Hypothèses</label>
                            <Textarea 
                              value={differentialDiagnosis}
                              onChange={e => setDifferentialDiagnosis(e.target.value)}
                              placeholder="..."
                              className="min-h-[80px]"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Diagnostic Retenu <span className="text-rose-500">*</span></label>
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
                        <p className="text-sm text-slate-500 mb-4">Générez des ordonnances et des bons d'examens qui seront transmis automatiquement.</p>
                        
                        <div className="flex gap-3 mb-6 flex-wrap">
                          {activeModules.pharmacie && (
                            <Button type="button" onClick={() => setOrderType('pharmacy')} variant="outline" className="text-blue-700 bg-blue-50/50 border-blue-200 hover:bg-blue-100 ring-0">
                              <Pill className="w-4 h-4 mr-2" /> Ordonnance Méd.
                            </Button>
                          )}
                          {activeModules.laboratoire && (
                            <Button type="button" onClick={() => setOrderType('lab')} variant="outline" className="text-purple-700 bg-purple-50/50 border-purple-200 hover:bg-purple-100 ring-0">
                              <TestTube className="w-4 h-4 mr-2" /> Bon Laboratoire
                            </Button>
                          )}
                          {activeModules.imagerie && (
                            <Button type="button" onClick={() => setOrderType('imagerie')} variant="outline" className="text-cyan-700 bg-cyan-50/50 border-cyan-200 hover:bg-cyan-100 ring-0">
                              <Crosshair className="w-4 h-4 mr-2" /> Échographie / Imagerie
                            </Button>
                          )}
                           <Button type="button" onClick={() => setOrderType('nursing')} variant="outline" className="text-rose-700 bg-rose-50/50 border-rose-200 hover:bg-rose-100 ring-0">
                             <Syringe className="w-4 h-4 mr-2" /> Soins Infirmiers
                           </Button>
                        </div>

                        {activePatientOrders.length > 0 && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                            <h4 className="font-semibold text-slate-800 text-sm">Prescriptions actées</h4>
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

                      <div className="pt-6 mt-6 border-t border-slate-100 space-y-4">
                        {formError && (
                          <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm font-medium flex items-start border border-red-200">
                            <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
                            {formError}
                          </div>
                        )}
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                          <div className="flex items-center space-x-3 w-full md:w-auto">
                            <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Orientation / Sortie :</label>
                            <select
                              className="w-full md:w-64 h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 disabled:bg-slate-100 disabled:text-slate-400"
                              value={transferTarget}
                              onChange={(e) => setTransferTarget(e.target.value)}
                              disabled={hospitalize}
                            >
                              {availableServices.map(s => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                              ))}
                            </select>
                          </div>
                          <Button type="button" onClick={() => processCloturer()} size="lg" className="w-full md:w-auto bg-rose-600 hover:bg-rose-700 shadow-md ring-0">
                            <Send className="w-4 h-4 mr-2" />
                            {hospitalize ? 'Hospitaliser & Clôturer' : transferTarget ? 'Transférer & Clôturer' : 'Enregistrer & Clôturer'}
                          </Button>
                        </div>
                        <label className={`flex items-center space-x-3 text-sm font-medium p-3 rounded-lg border cursor-pointer transition-colors ${hospitalize ? 'bg-indigo-50 border-indigo-300 text-indigo-900' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}>
                          <input
                            type="checkbox"
                            checked={hospitalize}
                            onChange={e => { setHospitalize(e.target.checked); if (e.target.checked) setTransferTarget(''); }}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Hospitaliser la patiente après cette consultation (maternité / salle d'hospitalisation)</span>
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
            <p className="text-lg font-medium text-slate-500">Sélectionnez une patiente dans la file d'attente</p>
            <p className="text-sm mt-2">Son dossier médical s'affichera ici.</p>
          </div>
        )}
      </div>

      <PrescriptionBuilder
        type={orderType}
        onClose={() => setOrderType(null)}
        onSubmit={submitOrder}
        patientName={selectedPatient?.name || ''}
        patientAge={selectedPatient?.age?.toString() || ''}
        patientGender={selectedPatient?.gender || ''}
      />

      {/* Export PDF du dossier patient complet */}
      {showPDFExport && selectedPatient && (
        <div className="fixed inset-0 z-[110] bg-stone-950/70 backdrop-blur-md overflow-y-auto p-4 md:p-8">
          <div className="flex items-center justify-between max-w-[210mm] mx-auto mb-4 no-print">
            <h2 className="text-lg font-bold text-white">Dossier Patient — {selectedPatient.name}</h2>
            <div className="flex gap-2">
              <Button onClick={() => window.print()} className="btn-sheen bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl">
                <FileText className="w-4 h-4 mr-2" /> Imprimer / PDF
              </Button>
              <Button variant="outline" onClick={() => setShowPDFExport(false)} className="rounded-xl bg-white/10 text-white border-white/20">
                Fermer
              </Button>
            </div>
          </div>
          <PatientRecordPDF patient={selectedPatient} />
        </div>
      )}

      {/* Dictée médicale : transcription vocale → structuration IA → validation */}
      <MedicalDictation
        open={showDictation}
        onClose={() => setShowDictation(false)}
        pageName={`Gynécologie-Obstétrique (${consultType})`}
        schema={dictationSchema}
        enableOrders
        onApply={applyDictation}
      />
    </div>
  );
}
