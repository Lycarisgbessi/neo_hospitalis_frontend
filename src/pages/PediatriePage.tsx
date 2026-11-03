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
import { Clock, User, ClipboardList, Send, FileText, Pill, TestTube, Crosshair, Syringe, Activity, HeartPulse, Search, Stethoscope, AlertCircle, History, ShieldAlert, Baby, Scale, Brain, Mic, X } from 'lucide-react';

/** Champs communs à toutes les consultations pédiatriques. */
const PED_COMMON: Record<string, string> = {
  motif: "Motif principal de la venue",
  hdm: "Histoire de la maladie (début des symptômes, évolution, traitements reçus)",
  mode_de_garde: "Mode de garde / scolarité (crèche, nounou, maternelle...)",
  atcd_medicaux: "Antécédents médicaux et périnataux",
  atcd_familiaux: "Antécédents familiaux (allergies, terrain génétique, consanguinité)",
  poids: "Poids en kg",
  taille: "Taille en cm",
  pc: "Périmètre crânien en cm",
  temperature: "Température en °C",
  spo2: "Saturation en oxygène SpO2 en %",
  pouls: "Pouls en bpm",
  diagnostic_differentiel: "Diagnostics différentiels / hypothèses",
  diagnostic_final: "Diagnostic retenu / conclusion",
  // Audit F1 : orientation du patient pilotable à la voix
  orientation: "Service de transfert dicté : general (médecine générale), cardiologie, gynecologie ou chirurgie — UNIQUEMENT si explicitement dicté",
  hospitalisation: "Décision d'hospitaliser : 'oui' ou 'non' — UNIQUEMENT si explicitement dictée",
};

/** Schémas de dictée spécifiques au type d'évaluation pédiatrique. */
const PED_SCHEMAS: Record<string, Record<string, string>> = {
  generale: {
    ...PED_COMMON,
    etat_general: "État général de l'enfant",
    conscience: "État de conscience (éveillé, léthargique...)",
    orl: "Examen ORL (gorge, bouche, nez)",
    otoscopie: "Otoscopie (tympans)",
    auscultation_pulmonaire: "Auscultation pulmonaire (murmure vésiculaire, râles)",
    signes_de_lutte: "Signes de lutte / détresse respiratoire (tirage, geignement...)",
    cardio: "Auscultation cardiaque et pouls (souffle...)",
    trc: "Temps de recoloration cutanée (TRC)",
    abdomen: "Palpation abdominale",
    hepato_splenomegalie: "Hépato-splénomégalie, ganglions",
    neuro: "Examen neurologique (tonus, réflexes)",
    cutane: "Examen cutané (éruption, purpura)",
  },
  croissance: {
    ...PED_COMMON,
    alimentation: "Type d'alimentation (allaitement exclusif, mixte, diversification...)",
    nb_repas: "Nombre de repas par jour",
    appetit: "Qualité de l'appétit",
    troubles_alim: "Troubles alimentaires et carences suspectées",
    courbes: "Analyse des courbes de croissance (poids/taille/PC)",
    tenue_tete: "Tenue de la tête (âge d'acquisition)",
    position_assise: "Position assise (âge d'acquisition)",
    marche: "Marche (âge d'acquisition)",
    langage: "Langage et ouïe",
    sociabilite: "Sociabilité et comportement",
    scolarite: "Scolarité / apprentissages",
    dentition: "Dentition (nombre de dents)",
  },
  vaccination: {
    ...PED_COMMON,
    vaccins_ce_jour: "Vaccins effectués ou prescrits ce jour",
    prochains_vaccins: "Prochains vaccins prévus (lesquels et quand)",
  },
  neonat: {
    ...PED_COMMON,
    atcd_maternels: "Antécédents maternels (âge, parité, maladies)",
    deroulement_grossesse: "Déroulement de la grossesse",
    apgar_1: "Score d'Apgar à 1 minute",
    apgar_5: "Score d'Apgar à 5 minutes",
    apgar_10: "Score d'Apgar à 10 minutes",
    silverman: "Score de Silverman (détresse respiratoire)",
    cri: "Cri du nouveau-né",
    tonus: "Tonus du nouveau-né",
    reflexes: "Réflexes archaïques (Moro, succion...)",
    ictere: "Ictère",
    mensurations: "Mensurations de naissance (poids, taille, PC)",
  },
};

export default function PediatriePage() {
  const { patients, updatePatient, currentUser, activeModules, addConsultation, addOrder, consultations, orders, users } = useApp();
  const { registerPage, unregisterPage } = useAI();

  // ── Audit F3a : enregistrement auprès de l'assistant vocal (page muette avant) ──
  useEffect(() => {
    registerPage(
      'Pédiatrie',
      {
        motif: "Motif principal de la venue",
        hdm: "Histoire de la maladie",
        poids: "Poids en kg",
        taille: "Taille en cm",
        temperature: "Température en °C",
        diagnostic_final: "Diagnostic retenu",
        dictee: "Mettre 'oui' pour ouvrir la fenêtre de dictée médicale complète",
      },
      (action) => {
        if (action.type === 'fill_form' && action.payload) {
          const payload = action.payload as Record<string, unknown>;
          if (payload.dictee === 'oui' || payload.dictee === true) { setShowDictation(true); return; }
          if (typeof payload.motif === 'string' && payload.motif) setChiefComplaint(payload.motif);
          if (typeof payload.hdm === 'string') setHistoryCards(h => ({ ...h, histoireMaladie: payload.hdm as string }));
          if (typeof payload.poids === 'string') setVitals(v => ({ ...v, weight: payload.poids as string }));
          if (typeof payload.taille === 'string') setVitals(v => ({ ...v, height: payload.taille as string }));
          if (typeof payload.temperature === 'string') setVitals(v => ({ ...v, temperature: payload.temperature as string }));
          if (typeof payload.diagnostic_final === 'string' && payload.diagnostic_final) setFinalDiagnosis(payload.diagnostic_final);
        }
      }
    );
    return () => unregisterPage();
  }, [registerPage, unregisterPage]);
  
  // Audit W1 : cloisonnement polyclinique — un médecin affecté à un autre service
  // (hors généralistes) ne consulte pas en pédiatrie ; super_admin y a pleinement accès.
  const medecinHorsService =
    currentUser?.role === 'medecin' &&
    Boolean(currentUser.service) &&
    currentUser.service !== 'general' &&
    currentUser.service !== 'pediatrie';

  const myPatients = medecinHorsService ? [] : patients
    .filter(p =>
      p.targetService === 'pediatrie' &&
      p.status !== 'waiting_payment' &&
      // Consultation réglée obligatoire (transférés non payés → caisse) ;
      // les patients traités restent visibles pour l'historique (audit B1).
      p.consultationFeePaid
    )
    // Urgences pédiatriques du triage en priorité, puis patients actifs avant
    // dossiers clôturés (audit R2), puis ordre d'arrivée
    .sort((a, b) =>
      Number(b.pediatrieTriage?.urgence ?? 0) - Number(a.pediatrieTriage?.urgence ?? 0) ||
      Number(a.status === 'treated') - Number(b.status === 'treated') ||
      (a.arrivalTime ?? '').localeCompare(b.arrivalTime ?? '')
    );

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // Triage Pediatrique Data
  const pedTriage = selectedPatient?.pediatrieTriage;

  const [activeTab, setActiveTab] = useState('consultation');
  const [isNewConsultationEnabled, setIsNewConsultationEnabled] = useState(false);
  const [consultType, setConsultType] = useState('generale'); // generale, croissance, vaccination, neonat

  // Common Form State
  const [vitals, setVitals] = useState({ temperature: '', bloodPressure: '', heartRate: '', respiratoryRate: '', o2Saturation: '', weight: '', height: '', bmi: '', pc: '' });
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [historyCards, setHistoryCards] = useState({ histoireMaladie: '', modeGarde: '', medical: '', surgical: '', family: '', allergies: '', lifestyle: '' });
  const [differentialDiagnosis, setDifferentialDiagnosis] = useState('');
  const [finalDiagnosis, setFinalDiagnosis] = useState('');
  const [formError, setFormError] = useState('');

  // Pediatrie Specific States
  const [examPhysical, setExamPhysical] = useState({ etatGeneral: '', conscience: '', coloration: '', hydratation: '', scoreDouleur: '', orl: '', otoscopie: '', pleuropulmonaire: '', signesDeLutte: '', cardio: '', trc: '', abdo: '', hepatoSplenomegalie: '', neuro: '', cutane: '', organesGenitaux: '' });
  const [croissance, setCroissance] = useState({ alimentationType: '', nbRepas: '', qualiteAppetit: '', tenueTete: '', positionAssise: '', marche: '', dentition: '', motriciteFine: '', langage: '', sociabilite: '', scolarite: '', courbes: '', troublesAlim: '' });
  const [vaccination, setVaccination] = useState({ carnetAJour: 'Oui', bcgPolio0: false, penta1: false, penta2: false, penta3: false, rotavirus: false, pneumocoque: false, rrFj: false, vitamineA: false, deparasitage: false, vaccinsCeJour: '', prochainsVaccins: '', reactions: '', observations: '' });
  const [neonat, setNeonat] = useState({ atcdMaternels: '', serologiesMat: '', deroulementGrossesse: '', modeAccouchement: 'Voie Basse', liquideAmniotique: 'Clair', ruptureMembranes: '', apgar1: '', apgar5: '', apgar10: '', reanimation: 'Non', silverman: '', cri: '', tonus: '', reflexesArchaiques: '', ictere: '', mensurationsNaiss: '', traitementNaiss: '' });

  // Modals & Transfer state
  const [orderType, setOrderType] = useState<'pharmacy' | 'lab' | 'imagerie' | 'nursing' | null>(null);
  const [transferTarget, setTransferTarget] = useState('');
  // Hospitalisation après clôture (prioritaire sur le transfert)
  const [hospitalize, setHospitalize] = useState(false);

  // Dictée médicical
  const [showDictation, setShowDictation] = useState(false);
  const [showPDFExport, setShowPDFExport] = useState(false);
  const [dictatedSections, setDictatedSections] = useState<string[]>([]);
  const dictationSchema = PED_SCHEMAS[consultType] ?? PED_COMMON;

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
      'gynecologie': 'gynecologie',
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

    if (f.hdm || f.mode_de_garde || f.atcd_medicaux || f.atcd_familiaux) {
      setHistoryCards(h => ({
        ...h,
        ...(f.hdm ? { histoireMaladie: f.hdm } : {}),
        ...(f.mode_de_garde ? { modeGarde: f.mode_de_garde } : {}),
        ...(f.atcd_medicaux ? { medical: f.atcd_medicaux } : {}),
        ...(f.atcd_familiaux ? { family: f.atcd_familiaux } : {}),
      }));
      applied.push('Antécédents & HDM');
    }

    if (f.poids || f.taille || f.pc || f.temperature || f.spo2 || f.pouls) {
      setVitals(v => ({
        ...v,
        ...(f.poids ? { weight: f.poids } : {}),
        ...(f.taille ? { height: f.taille } : {}),
        ...(f.pc ? { pc: f.pc } : {}),
        ...(f.temperature ? { temperature: f.temperature } : {}),
        ...(f.spo2 ? { o2Saturation: f.spo2 } : {}),
        ...(f.pouls ? { heartRate: f.pouls } : {}),
      }));
      applied.push('Biométrie');
    }

    if (consultType === 'generale' && (f.etat_general || f.conscience || f.orl || f.otoscopie || f.auscultation_pulmonaire || f.signes_de_lutte || f.cardio || f.trc || f.abdomen || f.hepato_splenomegalie || f.neuro || f.cutane)) {
      setExamPhysical(p => ({
        ...p,
        ...(f.etat_general ? { etatGeneral: f.etat_general } : {}),
        ...(f.conscience ? { conscience: f.conscience } : {}),
        ...(f.orl ? { orl: f.orl } : {}),
        ...(f.otoscopie ? { otoscopie: f.otoscopie } : {}),
        ...(f.auscultation_pulmonaire ? { pleuropulmonaire: f.auscultation_pulmonaire } : {}),
        ...(f.signes_de_lutte ? { signesDeLutte: f.signes_de_lutte } : {}),
        ...(f.cardio ? { cardio: f.cardio } : {}),
        ...(f.trc ? { trc: f.trc } : {}),
        ...(f.abdomen ? { abdo: f.abdomen } : {}),
        ...(f.hepato_splenomegalie ? { hepatoSplenomegalie: f.hepato_splenomegalie } : {}),
        ...(f.neuro ? { neuro: f.neuro } : {}),
        ...(f.cutane ? { cutane: f.cutane } : {}),
      }));
      applied.push('Examen physique');
    }

    if (consultType === 'croissance' && (f.alimentation || f.nb_repas || f.appetit || f.troubles_alim || f.courbes || f.tenue_tete || f.position_assise || f.marche || f.langage || f.sociabilite || f.scolarite || f.dentition)) {
      setCroissance(c => ({
        ...c,
        ...(f.alimentation ? { alimentationType: f.alimentation } : {}),
        ...(f.nb_repas ? { nbRepas: f.nb_repas } : {}),
        ...(f.appetit ? { qualiteAppetit: f.appetit } : {}),
        ...(f.troubles_alim ? { troublesAlim: f.troubles_alim } : {}),
        ...(f.courbes ? { courbes: f.courbes } : {}),
        ...(f.tenue_tete ? { tenueTete: f.tenue_tete } : {}),
        ...(f.position_assise ? { positionAssise: f.position_assise } : {}),
        ...(f.marche ? { marche: f.marche } : {}),
        ...(f.langage ? { langage: f.langage } : {}),
        ...(f.sociabilite ? { sociabilite: f.sociabilite } : {}),
        ...(f.scolarite ? { scolarite: f.scolarite } : {}),
        ...(f.dentition ? { dentition: f.dentition } : {}),
      }));
      applied.push('Développement');
    }

    if (consultType === 'vaccination' && (f.vaccins_ce_jour || f.prochains_vaccins)) {
      setVaccination(v => ({
        ...v,
        ...(f.vaccins_ce_jour ? { vaccinsCeJour: f.vaccins_ce_jour } : {}),
        ...(f.prochains_vaccins ? { prochainsVaccins: f.prochains_vaccins } : {}),
      }));
      applied.push('Vaccination');
    }

    if (consultType === 'neonat' && (f.atcd_maternels || f.deroulement_grossesse || f.apgar_1 || f.apgar_5 || f.apgar_10 || f.silverman || f.cri || f.tonus || f.reflexes || f.ictere || f.mensurations)) {
      setNeonat(n => ({
        ...n,
        ...(f.atcd_maternels ? { atcdMaternels: f.atcd_maternels } : {}),
        ...(f.deroulement_grossesse ? { deroulementGrossesse: f.deroulement_grossesse } : {}),
        ...(f.apgar_1 ? { apgar1: f.apgar_1 } : {}),
        ...(f.apgar_5 ? { apgar5: f.apgar_5 } : {}),
        ...(f.apgar_10 ? { apgar10: f.apgar_10 } : {}),
        ...(f.silverman ? { silverman: f.silverman } : {}),
        ...(f.cri ? { cri: f.cri } : {}),
        ...(f.tonus ? { tonus: f.tonus } : {}),
        ...(f.reflexes ? { reflexesArchaiques: f.reflexes } : {}),
        ...(f.ictere ? { ictere: f.ictere } : {}),
        ...(f.mensurations ? { mensurationsNaiss: f.mensurations } : {}),
      }));
      applied.push('Néonatologie');
    }

    if (f.diagnostic_differentiel) { setDifferentialDiagnosis(f.diagnostic_differentiel); applied.push('Diagnostic différentiel'); }
    if (f.diagnostic_final) { setFinalDiagnosis(f.diagnostic_final); applied.push('Diagnostic final'); }

    // Actes & prescriptions issus de la même dictée
    const actes = applyDictatedOrders(orders);
    setDictatedSections([...applied, ...actes]);
  };

  const availableServices = [
    { id: '', label: 'Ne pas transférer (Clôturer le dossier)' },
    { id: 'general', label: 'Médecine Générale' },
    ...(activeModules.cardiologie && selectedPatient?.targetService !== 'cardiologie' ? [{ id: 'cardiologie', label: 'Cardiologie' }] : []),
    ...(activeModules.gynecologie && selectedPatient?.targetService !== 'gynecologie' ? [{ id: 'gynecologie', label: 'Gynécologie' }] : []),
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
      if (p?.pediatrieTriage?.motif) {
        setChiefComplaint(p.pediatrieTriage.motif);
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
    if (consultType === 'generale') specialtyData = examPhysical;
    else if (consultType === 'croissance') specialtyData = croissance;
    else if (consultType === 'vaccination') specialtyData = vaccination;
    else if (consultType === 'neonat') specialtyData = neonat;

    const newConsultation: Consultation = {
      id: generateId('CONS-PED'),
      patientId: selectedPatientId,
      date: new Date().toISOString(),
      doctorId: currentUser.id,
      vitals,
      chiefComplaint,
      historyCards,
      generalSigns: examPhysical.etatGeneral,
      functionalSigns: '',
      physicalExam: { inspection: examPhysical.cutane, palpation: examPhysical.abdo, percussion: '', auscultation: examPhysical.pleuropulmonaire },
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
    setVitals({ temperature: '', bloodPressure: '', heartRate: '', respiratoryRate: '', o2Saturation: '', weight: '', height: '', bmi: '', pc: '' });
    setChiefComplaint('');
    setHistoryCards({ histoireMaladie: '', modeGarde: '', medical: '', surgical: '', family: '', allergies: '', lifestyle: '' });
    setDifferentialDiagnosis('');
    setFinalDiagnosis('');
    setExamPhysical({ etatGeneral: '', conscience: '', coloration: '', hydratation: '', scoreDouleur: '', orl: '', otoscopie: '', pleuropulmonaire: '', signesDeLutte: '', cardio: '', trc: '', abdo: '', hepatoSplenomegalie: '', neuro: '', cutane: '', organesGenitaux: '' });
    setCroissance({ alimentationType: '', nbRepas: '', qualiteAppetit: '', tenueTete: '', positionAssise: '', marche: '', dentition: '', motriciteFine: '', langage: '', sociabilite: '', scolarite: '', courbes: '', troublesAlim: '' });
    setVaccination({ carnetAJour: 'Oui', bcgPolio0: false, penta1: false, penta2: false, penta3: false, rotavirus: false, pneumocoque: false, rrFj: false, vitamineA: false, deparasitage: false, vaccinsCeJour: '', prochainsVaccins: '', reactions: '', observations: '' });
    setNeonat({ atcdMaternels: '', serologiesMat: '', deroulementGrossesse: '', modeAccouchement: 'Voie Basse', liquideAmniotique: 'Clair', ruptureMembranes: '', apgar1: '', apgar5: '', apgar10: '', reanimation: 'Non', silverman: '', cri: '', tonus: '', reflexesArchaiques: '', ictere: '', mensurationsNaiss: '', traitementNaiss: '' });
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

  // Audit X4 : le médecin voit aussi les actes EXÉCUTÉS
  const activePatientOrders = orders.filter(o => o.patientId === selectedPatientId && ['pending', 'paid', 'completed'].includes(o.status));

  const renderHistoryDetails = (cons: Consultation) => (
    // Audit X1 : rendu partagé — lisible depuis toutes les pages de consultation
    <ConsultationSpecialtyDetails cons={cons} />
  );

  const consultTypes = [
    { id: 'generale', label: 'Consultation Générale' },
    { id: 'croissance', label: 'Développement & Nutrition' },
    { id: 'vaccination', label: 'Vaccination (PEV)' },
    { id: 'neonat', label: 'Néonatologie' }
  ];

  return (
    <div className="space-y-6 flex flex-col md:flex-row gap-6">
      {/* LEFT PANEL */}
      <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-sky-600" />
            File Pédiatrie
          </h2>
          <Badge variant="outline">{myPatients.length}</Badge>
        </div>
        
        <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-140px)] pr-2">
          {medecinHorsService ? (
            <div className="p-8 text-center border border-amber-200 bg-amber-50 rounded-xl space-y-2">
              <ShieldAlert className="w-10 h-10 mx-auto text-amber-500" />
              <p className="font-semibold text-amber-900">Consultation réservée au service Pédiatrie</p>
              <p className="text-sm text-amber-800">
                Vous êtes affecté au service « {currentUser?.service} » — en mode polyclinique cloisonnée,
                ce module est accessible aux praticiens de pédiatrie et au super administrateur.
              </p>
            </div>
          ) : myPatients.length === 0 ? (
            <div className="p-8 text-center text-slate-500 border border-dashed rounded-xl">
              Aucun enfant en attente.
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
                className={`p-4 rounded-xl border cursor-pointer transition-all animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 ${selectedPatientId === p.id ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-500 shadow-sm' : 'border-slate-200 bg-white hover:border-sky-300 shadow-sm'}`}
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

      {/* RIGHT PANEL */}
      <div className="w-full md:w-2/3 lg:w-3/4">
        {selectedPatient ? (
          <Card className="h-full border-slate-200 shadow-sm flex flex-col">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 rounded-t-xl py-4 shrink-0">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-lg">
                    {selectedPatient.name.charAt(0)}
                  </div>
                  <div>
                    <CardTitle className="text-xl">{selectedPatient.name}</CardTitle>
                    <p className="text-sm text-slate-500">
                      ID: {selectedPatient.id} • {selectedPatient.age} ans • Tél parent: {selectedPatient.phone || 'Non renseigné'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-white text-sky-700 border-sky-200">Pédiatrie</Badge>
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
                  
                  {/* HISTORY TAB */}
                  <TabsContent value="history" className="mt-0 space-y-6">
                    {pedTriage && (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-sky-50 rounded-xl border border-sky-100 relative">
                        <div className="md:col-span-4 pb-2 border-b border-sky-100 font-semibold text-sky-800 flex items-center">
                           <ShieldAlert className="w-4 h-4 mr-2" /> Triage Réception
                        </div>
                        <div><p className="text-xs text-sky-500 uppercase tracking-wider font-bold">Motif</p><p className="font-medium text-slate-800">{pedTriage.motif}</p></div>
                        <div><p className="text-xs text-sky-500 uppercase tracking-wider font-bold">Nutrition Apparente</p><p className="font-medium text-slate-800">{pedTriage.nutrition}</p></div>
                        <div><p className="text-xs text-sky-500 uppercase tracking-wider font-bold">Triage Poids Est.</p><p className="font-medium text-slate-800">{pedTriage.poidsEstime ? `${pedTriage.poidsEstime}kg` : '-'}</p></div>
                        <div><p className="text-xs text-sky-500 uppercase tracking-wider font-bold">Triage Temp.</p><p className="font-medium text-slate-800">{pedTriage.tempEstimee ? `${pedTriage.tempEstimee}°C` : '-'}</p></div>
                        
                        {pedTriage.urgence && (
                          <div className="md:col-span-4 mt-2 p-3 bg-red-100 text-red-800 border border-red-200 rounded-lg text-sm font-semibold flex items-center">
                            <AlertCircle className="w-4 h-4 mr-2" /> Urgence Signalée : {pedTriage.urgenceDesc}
                          </div>
                        )}
                        {pedTriage.referee && (
                          <div className="md:col-span-4 mt-2 p-3 bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-sm font-semibold flex items-center">
                             Référé par : {pedTriage.refereeDesc}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold flex items-center"><History className="w-5 h-5 mr-2 text-slate-500"/> Historique Pédiatrique</h3>
                      {selectedPatient.status === 'treated' && !isNewConsultationEnabled && (
                        <Button onClick={startNewConsultation} size="sm" className="bg-sky-600 hover:bg-sky-700">
                          <Stethoscope className="w-4 h-4 mr-2" />
                          Nouvelle Consultation
                        </Button>
                      )}
                    </div>

                    {(!selectedPatient.history || selectedPatient.history.length === 0) ? (
                      <p className="text-slate-500 italic text-sm p-4 bg-slate-50 rounded-xl border border-dashed">Aucun historique disponible pour cet enfant.</p>
                    ) : (
                      <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6">
                        {selectedPatient.history.map((consultId, idx) => {
                          const cons = consultations.find(c => c.id === consultId);
                          if (!cons) return null;
                          return (
                            <div key={cons.id} className="relative p-5 border border-slate-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
                              <div className="absolute -left-[35px] top-5 w-4 h-4 rounded-full bg-sky-500 border-4 border-white shadow-sm" />
                              <div className="flex justify-between items-start pb-3 border-b border-slate-100 mb-3">
                                <div>
                                  <div className="font-bold text-slate-800">
                                    {new Date(cons.date).toLocaleDateString()}
                                  </div>
                                  <div className="text-xs text-sky-600 font-semibold uppercase tracking-wider mt-1 flex items-center">
                                    <Activity className="w-3 h-3 mr-1" /> {cons.specialtyType || 'Consultation Péd.'}
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
                                  <div><span className="font-semibold text-slate-600">Poids:</span> {cons.vitals?.weight || '-'}</div>
                                  <div><span className="font-semibold text-slate-600">Taille:</span> {cons.vitals?.height || '-'}</div>
                                  {cons.vitals?.pc && <div><span className="font-semibold text-slate-600">PC:</span> {cons.vitals.pc}</div>}
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

                  {/* CONSULTATION TAB */}
                  <TabsContent value="consultation" className="mt-0 space-y-8">
                    <form id="consultation-form" onSubmit={(e) => { e.preventDefault(); processCloturer(); }} className="space-y-8">
                      {/* Dictée médicale : remplissage vocal du formulaire */}
                      <div className="rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/50 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-start">
                          <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center mr-3 shrink-0">
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
                        <Button type="button" onClick={() => setShowDictation(true)} size="lg" className="bg-sky-600 hover:bg-sky-700 shadow-md shrink-0">
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
                        <label className="text-sm font-semibold text-slate-800 mb-3 block">Type d'Évaluation <span className="text-sky-500">*</span></label>
                        <div className="flex flex-wrap gap-2">
                          {consultTypes.map(type => (
                            <button
                              key={type.id}
                              type="button"
                              onClick={() => setConsultType(type.id)}
                              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                consultType === type.id 
                                  ? 'bg-sky-600 text-white shadow-md ring-2 ring-sky-200 ring-offset-2' 
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
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Motif Principal</label>
                                  <Input value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} placeholder="Raison de la venue..." className="bg-white" />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Mode de Garde / Scolarité</label>
                                  <Input value={historyCards.modeGarde} onChange={e => setHistoryCards({...historyCards, modeGarde: e.target.value})} placeholder="Crèche, Nounou, Maternelle..." className="bg-white" />
                                </div>
                              </div>
                              <div>
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Histoire de la Maladie (HDM)</label>
                                <Textarea value={historyCards.histoireMaladie} onChange={e => setHistoryCards({...historyCards, histoireMaladie: e.target.value})} placeholder="Début des symptômes, évolution, traitements reçus..." className="min-h-[80px] bg-white"/>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">ATCD Médicaux & Périnataux</label>
                                  <Textarea value={historyCards.medical} onChange={e => setHistoryCards({...historyCards, medical: e.target.value})} placeholder="Périnataux (grossesse, accouchement), Médicaux, Chirurgicaux..." className="min-h-[60px] bg-white"/>
                                </div>
                                <div>
                                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">ATCD Familiaux & Allergies</label>
                                  <Textarea value={historyCards.family} onChange={e => setHistoryCards({...historyCards, family: e.target.value})} placeholder="Allergies, Terrain génétique, Consanguinité, Fratrie..." className="min-h-[60px] bg-white"/>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-md font-semibold mb-4 flex items-center text-slate-800"><Scale className="w-5 h-5 mr-2 text-slate-400"/> Biométrie & Constantes</h3>
                            <div className="grid grid-cols-3 gap-3 mb-3">
                              <div><label className="text-xs font-semibold text-slate-500 block mb-1">Poids (kg)</label><Input value={vitals.weight} onChange={e => setVitals({...vitals, weight: e.target.value})} placeholder="ex: 12" className="bg-white h-9"/></div>
                              <div><label className="text-xs font-semibold text-slate-500 block mb-1">Taille (cm)</label><Input value={vitals.height} onChange={e => setVitals({...vitals, height: e.target.value})} placeholder="ex: 85" className="bg-white h-9"/></div>
                              <div><label className="text-xs font-semibold text-slate-500 block mb-1">PC (cm)</label><Input value={vitals.pc} onChange={e => setVitals({...vitals, pc: e.target.value})} placeholder="Périm. Crânien" className="bg-white h-9"/></div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div><label className="text-xs font-semibold text-slate-500 block mb-1">Temp. (°C)</label><Input value={vitals.temperature} onChange={e => setVitals({...vitals, temperature: e.target.value})} placeholder="ex: 37.8" className="bg-white h-9"/></div>
                              <div><label className="text-xs font-semibold text-slate-500 block mb-1">Sat O2 (%)</label><Input value={vitals.o2Saturation} onChange={e => setVitals({...vitals, o2Saturation: e.target.value})} placeholder="ex: 98" className="bg-white h-9"/></div>
                              <div><label className="text-xs font-semibold text-slate-500 block mb-1">Pouls</label><Input value={vitals.heartRate} onChange={e => setVitals({...vitals, heartRate: e.target.value})} placeholder="bpm" className="bg-white h-9"/></div>
                            </div>
                          </div>
                        </div>

                        {/* RIGHT COLUMN: DYNAMIC SPECIALTY FIELDS */}
                        <div className="space-y-8">
                          
                          {consultType === 'generale' && (
                            <div className="bg-sky-50/50 p-6 rounded-xl border border-sky-100 space-y-6 shadow-sm">
                               <h3 className="text-md font-semibold flex items-center text-sky-800"><Stethoscope className="w-5 h-5 mr-2"/>Examen Physique Système par Système</h3>
                               
                               <div className="space-y-4">
                                 <h4 className="text-sm font-semibold text-sky-700 border-b border-sky-100 pb-1">1. Paramètres Généraux</h4>
                                 <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">État Général</label><Input value={examPhysical.etatGeneral} onChange={e=>setExamPhysical({...examPhysical, etatGeneral: e.target.value})} placeholder="Bon, Altéré..." className="bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Conscience</label><Input value={examPhysical.conscience} onChange={e=>setExamPhysical({...examPhysical, conscience: e.target.value})} placeholder="Éveillé, Lethargique..." className="bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Coloration</label><Input value={examPhysical.coloration} onChange={e=>setExamPhysical({...examPhysical, coloration: e.target.value})} placeholder="Rose, Pâle, Ictérique..." className="bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Hydratation</label><Input value={examPhysical.hydratation} onChange={e=>setExamPhysical({...examPhysical, hydratation: e.target.value})} placeholder="Pli cutané, sécheresse..." className="bg-white"/></div>
                                    <div className="md:col-span-2"><label className="text-xs font-semibold text-slate-500 block mb-1">Évaluation de la Douleur (Score)</label><Input value={examPhysical.scoreDouleur} onChange={e=>setExamPhysical({...examPhysical, scoreDouleur: e.target.value})} placeholder="ex: EVENDOL 4/15, FLACC..." className="bg-white"/></div>
                                 </div>
                               </div>

                               <div className="space-y-4">
                                 <h4 className="text-sm font-semibold text-sky-700 border-b border-sky-100 pb-1">2. Respiratoire & ORL</h4>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                   <div><label className="text-xs font-semibold text-slate-500 block mb-1">Gorge / Bouche / Nez</label><Textarea value={examPhysical.orl} onChange={e=>setExamPhysical({...examPhysical, orl: e.target.value})} placeholder="Amygdales, rhinorrhée..." className="min-h-[50px] bg-white"/></div>
                                   <div><label className="text-xs font-semibold text-slate-500 block mb-1">Otoscopie (Tympans)</label><Textarea value={examPhysical.otoscopie} onChange={e=>setExamPhysical({...examPhysical, otoscopie: e.target.value})} placeholder="Tympan normal, congestif, bombé..." className="min-h-[50px] bg-white"/></div>
                                   <div><label className="text-xs font-semibold text-slate-500 block mb-1">Auscultation Pulmonaire</label><Textarea value={examPhysical.pleuropulmonaire} onChange={e=>setExamPhysical({...examPhysical, pleuropulmonaire: e.target.value})} placeholder="Murmure vésiculaire, râles..." className="min-h-[50px] bg-white"/></div>
                                   <div><label className="text-xs font-semibold text-slate-500 block mb-1">Signes de Lutte / Détresse Respiratoire</label><Textarea value={examPhysical.signesDeLutte} onChange={e=>setExamPhysical({...examPhysical, signesDeLutte: e.target.value})} placeholder="Tirage, entonnoir, battement ailes du nez, geignement..." className="min-h-[50px] bg-white"/></div>
                                 </div>
                               </div>

                               <div className="space-y-4">
                                 <h4 className="text-sm font-semibold text-sky-700 border-b border-sky-100 pb-1">3. Cardiovasculaire</h4>
                                 <div className="grid grid-cols-2 gap-3">
                                   <div><label className="text-xs font-semibold text-slate-500 block mb-1">Auscultation & Pouls</label><Input value={examPhysical.cardio} onChange={e=>setExamPhysical({...examPhysical, cardio: e.target.value})} placeholder="Bruits du cœur, souffle..." className="bg-white"/></div>
                                   <div><label className="text-xs font-semibold text-slate-500 block mb-1">TRC (Temps Recoloration Cutanée)</label><Input value={examPhysical.trc} onChange={e=>setExamPhysical({...examPhysical, trc: e.target.value})} placeholder="< 3s..." className="bg-white"/></div>
                                 </div>
                               </div>

                               <div className="space-y-4">
                                 <h4 className="text-sm font-semibold text-sky-700 border-b border-sky-100 pb-1">4. Appareil Digestif</h4>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Palpation Abdominale</label><Textarea value={examPhysical.abdo} onChange={e=>setExamPhysical({...examPhysical, abdo: e.target.value})} placeholder="Souple, dépression, masses..." className="min-h-[50px] bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Hémato (Hépato-splénomégalie)</label><Textarea value={examPhysical.hepatoSplenomegalie} onChange={e=>setExamPhysical({...examPhysical, hepatoSplenomegalie: e.target.value})} placeholder="Foie, rate, ganglions..." className="min-h-[50px] bg-white"/></div>
                                 </div>
                               </div>

                               <div className="space-y-4">
                                 <h4 className="text-sm font-semibold text-sky-700 border-b border-sky-100 pb-1">5. Neuro, Ostéo, Cutané & OGE</h4>
                                 <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Examen Neurologique</label><Textarea value={examPhysical.neuro} onChange={e=>setExamPhysical({...examPhysical, neuro: e.target.value})} placeholder="Tonus, réflexes, raideur..." className="min-h-[50px] bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Peau et Phanéres</label><Textarea value={examPhysical.cutane} onChange={e=>setExamPhysical({...examPhysical, cutane: e.target.value})} placeholder="Éruption, purpura..." className="min-h-[50px] bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Examen OGE</label><Textarea value={examPhysical.organesGenitaux} onChange={e=>setExamPhysical({...examPhysical, organesGenitaux: e.target.value})} placeholder="..." className="min-h-[50px] bg-white"/></div>
                                 </div>
                               </div>
                            </div>
                          )}

                          {consultType === 'croissance' && (
                            <div className="bg-orange-50/50 p-6 rounded-xl border border-orange-100 space-y-6 shadow-sm">
                               <h3 className="text-md font-semibold flex items-center text-orange-800"><Brain className="w-5 h-5 mr-2"/>Nutrition & Développement Psychomoteur</h3>
                               
                               <div className="space-y-4">
                                 <h4 className="text-sm font-semibold text-orange-700 border-b border-orange-100 pb-1">Diététique & Alimentation</h4>
                                 <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="md:col-span-2"><label className="text-xs font-semibold text-slate-500 block mb-1">Type d'Alimentation</label><Input value={croissance.alimentationType} onChange={e=>setCroissance({...croissance, alimentationType: e.target.value})} placeholder="Allaitement exclusif, mixte, diversification, PPN..." className="bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Nombre de repas</label><Input value={croissance.nbRepas} onChange={e=>setCroissance({...croissance, nbRepas: e.target.value})} className="bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Qualité de l'appétit</label><Input value={croissance.qualiteAppetit} onChange={e=>setCroissance({...croissance, qualiteAppetit: e.target.value})} placeholder="Bon, capricieux, anorexie..." className="bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Troubles & Carences Suspectées</label><Input value={croissance.troublesAlim} onChange={e=>setCroissance({...croissance, troublesAlim: e.target.value})} placeholder="Régurgitations, vomissements, carences..." className="bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Analyse des Courbes (Poids/Taille/PC)</label><Input value={croissance.courbes} onChange={e=>setCroissance({...croissance, courbes: e.target.value})} placeholder="Dans la norme, cassure, surpoids..." className="bg-white"/></div>
                                 </div>
                               </div>

                               <div className="space-y-4">
                                 <h4 className="text-sm font-semibold text-orange-700 border-b border-orange-100 pb-1">Jalons Moteurs Globaux</h4>
                                 <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Tenue de la Tête (âge acquis)</label><Input value={croissance.tenueTete} onChange={e=>setCroissance({...croissance, tenueTete: e.target.value})} placeholder="Ex: à 3 mois / Non acquis" className="bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Position Assise (âge acquis)</label><Input value={croissance.positionAssise} onChange={e=>setCroissance({...croissance, positionAssise: e.target.value})} placeholder="Ex: à 7 mois / Non acquis" className="bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Marche (âge acquis)</label><Input value={croissance.marche} onChange={e=>setCroissance({...croissance, marche: e.target.value})} placeholder="Ex: à 14 mois / Non acquis" className="bg-white"/></div>
                                 </div>
                               </div>

                               <div className="space-y-4">
                                 <h4 className="text-sm font-semibold text-orange-700 border-b border-orange-100 pb-1">Cognitif, Sensoriel & Scolarité</h4>
                                 <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Motricité Fine / Préhension</label><Input value={croissance.motriciteFine} onChange={e=>setCroissance({...croissance, motriciteFine: e.target.value})} placeholder="Pince, transfert d'objets..." className="bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Langage & Ouïe</label><Input value={croissance.langage} onChange={e=>setCroissance({...croissance, langage: e.target.value})} placeholder="Lallation, premiers mots, phrases..." className="bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Sociabilité & Comportement</label><Input value={croissance.sociabilite} onChange={e=>setCroissance({...croissance, sociabilite: e.target.value})} placeholder="Sourire réponse, regard..." className="bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Scolarité / Apprentissage</label><Input value={croissance.scolarite} onChange={e=>setCroissance({...croissance, scolarite: e.target.value})} placeholder="Niveau scolaire, difficultés..." className="bg-white"/></div>
                                    <div className="col-span-2"><label className="text-xs font-semibold text-slate-500 block mb-1">Dentition (Poussées)</label><Input value={croissance.dentition} onChange={e=>setCroissance({...croissance, dentition: e.target.value})} placeholder="Nb de dents, etc." className="bg-white"/></div>
                                 </div>
                               </div>
                            </div>
                          )}

                          {consultType === 'vaccination' && (
                            <div className="bg-emerald-50/50 p-6 rounded-xl border border-emerald-100 space-y-6 shadow-sm">
                               <h3 className="text-md font-semibold flex items-center text-emerald-800"><Syringe className="w-5 h-5 mr-2"/>Vaccination (Programme Élargi)</h3>
                               
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-emerald-100 pb-4">
                                 <div><label className="text-xs font-semibold text-slate-500 block mb-1">Le carnet de vaccination est-il à jour ?</label>
                                    <select className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:ring-emerald-500" value={vaccination.carnetAJour} onChange={e=>setVaccination({...vaccination, carnetAJour: e.target.value})}>
                                      <option>Oui, à jour</option><option>Non, retard constaté</option><option>Carnet perdu / absent</option>
                                    </select>
                                 </div>
                               </div>

                               <div className="space-y-3">
                                 <label className="text-xs font-semibold text-slate-500 block mb-1 mt-2">Bilan des vaccins reçus (Cocher si OK)</label>
                                 <div className="flex flex-wrap gap-4 p-4 bg-white rounded-lg border border-emerald-100">
                                   <label className="flex items-center space-x-2 whitespace-nowrap"><input type="checkbox" checked={vaccination.bcgPolio0} onChange={e=>setVaccination({...vaccination, bcgPolio0: e.target.checked})} className="rounded text-emerald-600 focus:ring-emerald-500"/> <span className="text-sm font-medium">BCG & Polio 0</span></label>
                                   <label className="flex items-center space-x-2 whitespace-nowrap"><input type="checkbox" checked={vaccination.penta1} onChange={e=>setVaccination({...vaccination, penta1: e.target.checked})} className="rounded text-emerald-600 focus:ring-emerald-500"/> <span className="text-sm font-medium">Penta 1 + Polio 1</span></label>
                                   <label className="flex items-center space-x-2 whitespace-nowrap"><input type="checkbox" checked={vaccination.penta2} onChange={e=>setVaccination({...vaccination, penta2: e.target.checked})} className="rounded text-emerald-600 focus:ring-emerald-500"/> <span className="text-sm font-medium">Penta 2 + Polio 2</span></label>
                                   <label className="flex items-center space-x-2 whitespace-nowrap"><input type="checkbox" checked={vaccination.penta3} onChange={e=>setVaccination({...vaccination, penta3: e.target.checked})} className="rounded text-emerald-600 focus:ring-emerald-500"/> <span className="text-sm font-medium">Penta 3 + Polio 3</span></label>
                                   <label className="flex items-center space-x-2 whitespace-nowrap"><input type="checkbox" checked={vaccination.rotavirus} onChange={e=>setVaccination({...vaccination, rotavirus: e.target.checked})} className="rounded text-emerald-600 focus:ring-emerald-500"/> <span className="text-sm font-medium">Rotavirus (Rota 1,2,3)</span></label>
                                   <label className="flex items-center space-x-2 whitespace-nowrap"><input type="checkbox" checked={vaccination.pneumocoque} onChange={e=>setVaccination({...vaccination, pneumocoque: e.target.checked})} className="rounded text-emerald-600 focus:ring-emerald-500"/> <span className="text-sm font-medium">Pneumocoque (PCV)</span></label>
                                   <label className="flex items-center space-x-2 whitespace-nowrap"><input type="checkbox" checked={vaccination.rrFj} onChange={e=>setVaccination({...vaccination, rrFj: e.target.checked})} className="rounded text-emerald-600 focus:ring-emerald-500"/> <span className="text-sm font-medium">RR + FJ (9 mois)</span></label>
                                   <label className="flex items-center space-x-2 whitespace-nowrap"><input type="checkbox" checked={vaccination.vitamineA} onChange={e=>setVaccination({...vaccination, vitamineA: e.target.checked})} className="rounded text-emerald-600 focus:ring-emerald-500"/> <span className="text-sm font-medium">Vitamine A</span></label>
                                   <label className="flex items-center space-x-2 whitespace-nowrap"><input type="checkbox" checked={vaccination.deparasitage} onChange={e=>setVaccination({...vaccination, deparasitage: e.target.checked})} className="rounded text-emerald-600 focus:ring-emerald-500"/> <span className="text-sm font-medium">Déparasitage</span></label>
                                 </div>
                               </div>

                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div><label className="text-xs font-semibold text-slate-500 block mb-1">Vaccins effectués ce jour</label><Textarea value={vaccination.vaccinsCeJour} onChange={e=>setVaccination({...vaccination, vaccinsCeJour: e.target.value})} placeholder="Qu'avez-vous administré ou prescrit ce jour ?" className="min-h-[60px] bg-white"/></div>
                                 <div><label className="text-xs font-semibold text-slate-500 block mb-1">Rendez-vous prochains vaccins</label><Textarea value={vaccination.prochainsVaccins} onChange={e=>setVaccination({...vaccination, prochainsVaccins: e.target.value})} placeholder="Quels vaccins et quand ?" className="min-h-[60px] bg-white"/></div>
                               </div>
                            </div>
                          )}

                          {consultType === 'neonat' && (
                            <div className="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100 space-y-6 shadow-sm">
                               <h3 className="text-md font-semibold flex items-center text-indigo-800"><Baby className="w-5 h-5 mr-2"/>Évaluation Néonatale</h3>
                               
                               <div className="space-y-4">
                                 <h4 className="text-sm font-semibold text-indigo-700 border-b border-indigo-100 pb-1">Contexte Périnatal</h4>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                   <div><label className="text-xs font-semibold text-slate-500 block mb-1">ATCD Maternels</label><Textarea value={neonat.atcdMaternels} onChange={e=>setNeonat({...neonat, atcdMaternels: e.target.value})} placeholder="Âge, Parité, Maladies..." className="min-h-[50px] bg-white"/></div>
                                   <div><label className="text-xs font-semibold text-slate-500 block mb-1">Sérologies Maternelles</label><Textarea value={neonat.serologiesMat} onChange={e=>setNeonat({...neonat, serologiesMat: e.target.value})} placeholder="VIH, Syphilis, AgHBs, Groupe Sanguin..." className="min-h-[50px] bg-white"/></div>
                                 </div>
                                 <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                   <div><label className="text-xs font-semibold text-slate-500 block mb-1">Déroulement Grossesse</label><Input value={neonat.deroulementGrossesse} onChange={e=>setNeonat({...neonat, deroulementGrossesse: e.target.value})} placeholder="Fièvre, Suivi régulier..." className="bg-white"/></div>
                                   <div><label className="text-xs font-semibold text-slate-500 block mb-1">Mode d'accouchement</label>
                                     <select className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-sm" value={neonat.modeAccouchement} onChange={e=>setNeonat({...neonat, modeAccouchement: e.target.value})}>
                                        <option>Voie Basse Spontanée</option><option>Voie Basse Instrumentale</option><option>Césarienne Urgence</option><option>Césarienne Programmée</option>
                                     </select>
                                   </div>
                                   <div><label className="text-xs font-semibold text-slate-500 block mb-1">Aspect Liquide Amniotique</label>
                                      <select className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-sm" value={neonat.liquideAmniotique} onChange={e=>setNeonat({...neonat, liquideAmniotique: e.target.value})}>
                                        <option>Clair</option><option>Teinté (Méconial)</option><option>Purulent</option><option>Hémorragique</option>
                                     </select>
                                   </div>
                                 </div>
                               </div>

                               <div className="space-y-4">
                                 <h4 className="text-sm font-semibold text-indigo-700 border-b border-indigo-100 pb-1">Adaptation à la vie extra-utérine</h4>
                                 <div className="grid grid-cols-3 gap-3">
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Apgar 1 min</label><Input type="number" value={neonat.apgar1} onChange={e=>setNeonat({...neonat, apgar1: e.target.value})} className="bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Apgar 5 min</label><Input type="number" value={neonat.apgar5} onChange={e=>setNeonat({...neonat, apgar5: e.target.value})} className="bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Apgar 10 min</label><Input type="number" value={neonat.apgar10} onChange={e=>setNeonat({...neonat, apgar10: e.target.value})} className="bg-white"/></div>
                                 </div>
                                 <div className="grid grid-cols-2 gap-3">
                                   <div><label className="text-xs font-semibold text-slate-500 block mb-1">Score de Silverman (Détresse Resp.)</label><Input type="number" value={neonat.silverman} onChange={e=>setNeonat({...neonat, silverman: e.target.value})} placeholder="0 à 10" className="bg-white"/></div>
                                   <div><label className="text-xs font-semibold text-slate-500 block mb-1">Réanimation en salle ?</label>
                                     <select className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-sm" value={neonat.reanimation} onChange={e=>setNeonat({...neonat, reanimation: e.target.value})}>
                                        <option>Non</option><option>Stimulation, Aspiration</option><option>Ventilation au Masque</option><option>Massage Cardiaque / Drogues</option>
                                     </select>
                                   </div>
                                 </div>
                               </div>

                               <div className="space-y-4">
                                 <h4 className="text-sm font-semibold text-indigo-700 border-b border-indigo-100 pb-1">Examen initial & Mensurations</h4>
                                 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Cri</label><Input value={neonat.cri} onChange={e=>setNeonat({...neonat, cri: e.target.value})} placeholder="Vigoureux, faible..." className="bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Tonus</label><Input value={neonat.tonus} onChange={e=>setNeonat({...neonat, tonus: e.target.value})} placeholder="Normal, hypotonie..." className="bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Réflexes Archaïques</label><Input value={neonat.reflexesArchaiques} onChange={e=>setNeonat({...neonat, reflexesArchaiques: e.target.value})} placeholder="Moro, succion..." className="bg-white"/></div>
                                    <div><label className="text-xs font-semibold text-slate-500 block mb-1">Ictère</label><Input value={neonat.ictere} onChange={e=>setNeonat({...neonat, ictere: e.target.value})} placeholder="Non pertinent / Oui" className="bg-white"/></div>
                                 </div>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                   <div><label className="text-xs font-semibold text-slate-500 block mb-1">Mensurations (T/P/PC) NNaiss.</label><Input value={neonat.mensurationsNaiss} onChange={e=>setNeonat({...neonat, mensurationsNaiss: e.target.value})} placeholder="Ex: 3.2kg, 50cm, PC 35cm" className="bg-white"/></div>
                                   <div><label className="text-xs font-semibold text-slate-500 block mb-1">Soins Précoces & Traitement</label><Textarea value={neonat.traitementNaiss} onChange={e=>setNeonat({...neonat, traitementNaiss: e.target.value})} placeholder="Soin cordon, collyre, Vit K..." className="min-h-[40px] bg-white"/></div>
                                 </div>
                               </div>
                            </div>
                          )}

                        </div>
                      </div>
                    </form>
                  </TabsContent>

                  <TabsContent value="diagnosis" className="mt-0">
                    {/* Dictée depuis Diagnostics (contrôle vocal total) */}
                    <div className="rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/40 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
                      <div className="flex items-start">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-600 to-indigo-600 text-white flex items-center justify-center mr-3 shrink-0">
                          <Mic className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-stone-900">Tout dicter — diagnostics, prescriptions, transfert</h3>
                          <p className="text-sm text-stone-500 mt-0.5">
                            Dictez d'un seul coup : examen, diagnostic, ordonnances, hospitalisation, orientation…
                          </p>
                        </div>
                      </div>
                      <Button type="button" onClick={() => setShowDictation(true)} size="lg" className="btn-sheen bg-gradient-to-r from-sky-600 to-indigo-600 shadow-glow shrink-0 rounded-xl">
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
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Diagnostic Retenu <span className="text-sky-500">*</span></label>
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
                              className="w-full md:w-64 h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-500 disabled:bg-slate-100 disabled:text-slate-400"
                              value={transferTarget}
                              onChange={(e) => setTransferTarget(e.target.value)}
                              disabled={hospitalize}
                            >
                              {availableServices.map(s => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                              ))}
                            </select>
                          </div>
                          <Button type="button" onClick={() => processCloturer()} size="lg" className="w-full md:w-auto bg-sky-600 hover:bg-sky-700 shadow-md ring-0">
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
                          <span>Hospitaliser l'enfant après cette consultation (pédiatrie / néonatologie)</span>
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
        pageName={`Pédiatrie (${consultType})`}
        schema={dictationSchema}
        enableOrders
        onApply={applyDictation}
      />
    </div>
  );
}
