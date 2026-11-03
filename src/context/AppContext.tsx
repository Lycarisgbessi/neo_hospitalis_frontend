import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// === CONSTANTS & CATALOGS ===
export const PRICING_CATALOG: Record<string, number> = {
  general: 15000,
  cardiologie: 50000,
  gynecologie: 40000,
  pediatrie: 30000,
  chirurgie: 60000,
  pharmacy: 0, 
  lab: 100000,
  imagerie: 250000,
  nursing: 20000,
};

export const INSURANCE_CATALOG: Record<string, number> = {
  'NSIA': 80,
  'SAHAM': 70,
  'UGAR': 100,
  'SOGAM': 80,
  'SUNU': 60
};

export const generateId = (prefix: string) => {
  return `${prefix}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
};

/**
 * Hachage de démonstration (NON SÉCURISÉ — algorithme djb2).
 * Ce logiciel est un prototype front-end sans backend : les mots de passe ne sont
 * jamais censés être de vrais secrets. Ne réutilisez jamais cette approche en production.
 */
export function hashPassword(password: string): string {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) + hash + password.charCodeAt(i)) >>> 0;
  }
  return `djb2$${hash.toString(16)}`;
}

export type ArchitectureMode = 'clinic' | 'polyclinic';
export type ModuleType = 'cardiologie' | 'gynecologie' | 'pediatrie' | 'chirurgie' | 'pharmacie' | 'laboratoire' | 'imagerie' | 'bloc';

export type UserRole = 
  | 'super_admin'
  | 'medecin' 
  | 'infirmier' 
  | 'pharmacien' 
  | 'technicien_labo' 
  | 'technicien_imagerie'
  | 'sage_femme'
  | 'receptionniste' 
  | 'caissier' 
  | 'comptable' 
  | 'responsable_rh' 
  | 'directeur_financier';

export interface User {
  id: string;
  name: string;
  volet: 'medical' | 'administratif' | 'administration';
  role: UserRole;
  service?: string;
  /** Hachage de démonstration (jamais le mot de passe en clair). */
  passwordHash: string;
  createdAt: string;
}

export interface VitalSigns {
  temperature?: string;
  bloodPressure?: string;
  heartRate?: string;
  respiratoryRate?: string;
  o2Saturation?: string;
  weight?: string;
  height?: string;
  /** Indice de masse corporelle (consultations générales). */
  bmi?: string;
  /** Périmètre crânien (pédiatrie). */
  pc?: string;
}

export interface HistoryCards {
  medical?: string;
  surgical?: string;
  family?: string;
  allergies?: string;
  lifestyle?: string;
  histoireMaladie?: string;
  modeGarde?: string;
}

export interface PhysicalExam {
  inspection?: string;
  palpation?: string;
  percussion?: string;
  auscultation?: string;
}

export interface Consultation {
  id: string;
  patientId: string;
  date: string;
  doctorId: string;
  vitals: VitalSigns;
  chiefComplaint: string;
  historyCards: HistoryCards;
  generalSigns: string;
  functionalSigns: string;
  physicalExam: PhysicalExam;
  anamnese: string;
  differentialDiagnosis: string;
  finalDiagnosis: string;
  status: 'draft' | 'completed';
  specialtyType?: string;
  /** Données structurées propres à la spécialité (gynéco, CPN, vaccination...). */
  specialtyData?: Record<string, unknown>;
}

export type OrderType = 'pharmacy' | 'lab' | 'imagerie' | 'nursing' | 'hospitalization';

export interface Order {
  id: string;
  patientId: string;
  type: OrderType;
  details: string;
  status: 'pending' | 'paid' | 'completed';
  fee: number;
  date: string;
  prescribedBy: string;
}

export interface Payment {
  id: string;
  patientId: string;
  items: { type: 'consultation' | 'order'; id: string; name: string; amount: number }[];
  subtotal: number;
  insuranceProvider?: string;
  insuranceCoveragePercentage: number;
  insuranceDeduction: number;
  totalPaid: number;
  paymentMethod: 'cash' | 'orange_money' | 'mobile_money' | 'visa';
  date: string;
  cashierId: string;
}

/** Ligne de résultat biologique (format ISO 15189 simplifié). */
export interface LabResultRow {
  param: string;
  result: string;
  unit: string;
  reference: string;
  flag: 'normal' | 'high' | 'low' | string;
}

/** Entrée du dossier médical longitudinal (labo, imagerie, soins, CPN...). */
export interface MedicalRecord {
  id: string;
  date: string;
  type: string;
  summary: string;
  details: Record<string, unknown> & { results?: LabResultRow[]; notes?: string };
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'M' | 'F';
  phone?: string;
  fatherName?: string;
  motherName?: string;
  neighborhood?: string;
  city?: string;
  bloodGroup?: string;
  rhFactor?: string;
  profession?: string;
  companionName?: string;
  companionPhone?: string;
  arrivalTime?: string;
  status: 'registered' | 'waiting_payment' | 'waiting_consultation' | 'consultation' | 'treated' | 'hospitalized';
  targetService: string;
  consultationFeePaid: boolean;
  /**
   * Mode d'admission :
   * - 'consultation'  : parcours standard (caisse → consultation → actes).
   * - 'exam_direct'   : accès direct aux examens (patient externe adressé par un
   *   prescripteur extérieur) — pas de frais de consultation, les ordres sont
   *   créés dès l'enregistrement, le dossier se clôt automatiquement une fois
   *   tous les examens exécutés.
   */
  admissionType?: 'consultation' | 'exam_direct';
  /** Médecin/prescripteur externe à l'origine des examens (accès direct). */
  externalPrescriber?: string;
  assignedDoctorId?: string;
  history: string[]; // consultation IDs
  gynecoTriage?: {
    motifPrincipal: string; // Consultation gynecologique / Consultation prenatale / Suivi de grossesse / Planification familiale / Procreation medicalement assistee / Urgence obstetricale / Post-partum / Autre
    situationObstetricale: string; // Pas de grossesse en cours / Grossesse en cours / Post-partum / Infertilite / Non concernee
    grossessesAnterieures: number; // 0 à 20
    parites: number; // 0 à 20
    ageGestationnel?: string; // 1er trimestre / 2eme trimestre / 3eme trimestre + nombre de semaines d'amenorrhee
    urgence: boolean;
    urgenceDesc?: string;
    referee: boolean;
    refereeDesc?: string;
    typeAdmission: string; // Consultation externe / Hospitalisation programmee / Urgence / Transfert inter-etablissement
  };
  pediatrieTriage?: {
    motif: string;
    poidsEstime?: string;
    tempEstimee?: string;
    nutrition: string;
    urgence: boolean;
    urgenceDesc?: string;
    signesDanger: string;
    referee: boolean;
    refereeDesc?: string;
  };
  medicalRecords?: MedicalRecord[];
}

export interface PurchaseOrder {
  id: string;
  service: ModuleType;
  items: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  date: string;
  createdBy: string;
}

export interface MaintenanceQuote {
  id: string;
  service: ModuleType;
  equipment: string;
  issue: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  date: string;
  createdBy: string;
}

/** Article du stock de la pharmacie interne. */
export interface StockItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  /** Seuil d'alerte de stock bas. */
  threshold: number;
}

export type ServiceBudgets = Record<string, number>;

/** Identité de l'établissement (configurée au premier démarrage, éditable dans les Paramètres). */
export interface HospitalProfile {
  name: string;
  city: string;
  phone: string;
}

/** Libellés d'affichage des types d'entrées du dossier médical longitudinal. */
export const RECORD_TYPE_LABELS: Record<string, string> = {
  lab_result: 'Résultats Laboratoire',
  imagerie_result: 'Compte-Rendu d\'Imagerie',
  soin_infirmier: 'Soin Infirmier',
  dispensation: 'Dispensation Pharmacie',
  cpn1: 'CPN 1',
  suivi: 'Suivi de Grossesse',
  vaccination: 'Vaccination',
  croissance: 'Suivi de Croissance',
  accouchement: 'Accouchement',
};

interface AppState {
  isSetup: boolean;
  architectureMode: ArchitectureMode;
  activeModules: Record<ModuleType, boolean>;
  currentUser: User | null;
  users: User[];
  patients: Patient[];
  consultations: Consultation[];
  orders: Order[];
  purchaseOrders: PurchaseOrder[];
  maintenanceQuotes: MaintenanceQuote[];
  payments: Payment[];
  serviceBudgets: ServiceBudgets;
  pharmacyStock: StockItem[];
  hospitalProfile: HospitalProfile;
  setHospitalProfile: (profile: HospitalProfile) => void;

  setSetup: (isSetup: boolean) => void;
  setArchitectureMode: (mode: ArchitectureMode) => void;
  toggleModule: (module: ModuleType) => void;
  setActiveModules: (modules: Record<ModuleType, boolean>) => void;
  login: (user: User) => void;
  logout: () => void;
  /** Crée un compte utilisateur dans le registre (et connecte celui-ci). */
  registerUser: (user: User) => void;
  /** Récupère un utilisateur inscrit par nom (insensible à la casse). */
  findUserByName: (name: string) => User | undefined;
  /** Récupère un utilisateur inscrit par ID (attribution des consultations). */
  getUserById: (id: string) => User | undefined;
  addPatient: (patient: Patient) => void;
  updatePatient: (id: string, updates: Partial<Patient>) => void;
  addConsultation: (consultation: Consultation) => void;
  addOrder: (order: Order) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  /**
   * Passe un ordre à 'completed' ET clôture automatiquement le dossier du
   * patient en accès direct ('exam_direct') lorsque tous ses examens sont
   * exécutés (transition waiting_consultation → treated).
   */
  completeOrder: (id: string) => void;
  addPurchaseOrder: (po: PurchaseOrder) => void;
  updatePurchaseOrder: (id: string, updates: Partial<PurchaseOrder>) => void;
  addMaintenanceQuote: (mq: MaintenanceQuote) => void;
  updateMaintenanceQuote: (id: string, updates: Partial<MaintenanceQuote>) => void;
  addPayment: (payment: Payment) => void;
  setServiceBudgets: (budgets: ServiceBudgets) => void;
  updateStockItem: (id: string, updates: Partial<StockItem>) => void;
  setPharmacyStock: (items: StockItem[]) => void;
  /** Efface toutes les données locales (retour aux valeurs d'usine). */
  resetAllData: () => void;
}

const defaultModules: Record<ModuleType, boolean> = {
  cardiologie: true,
  gynecologie: true,
  pediatrie: true,
  chirurgie: false,
  pharmacie: true,
  laboratoire: true,
  imagerie: true,
  bloc: false,
};

/** Version du schéma de persistance localStorage. Incrémenter à chaque rupture de compatibilité. */
const SCHEMA_VERSION = 2;
const SCHEMA_VERSION_KEY = 'hospi_schemaVersion';

const DEFAULT_SERVICE_BUDGET = 50_000_000; // 50 millions GNF

const defaultServiceBudgets: ServiceBudgets = {
  pharmacie: DEFAULT_SERVICE_BUDGET,
  laboratoire: DEFAULT_SERVICE_BUDGET,
  imagerie: DEFAULT_SERVICE_BUDGET,
  bloc: DEFAULT_SERVICE_BUDGET,
};

const defaultHospitalProfile: HospitalProfile = {
  name: "HÔPITAL CENTRAL",
  city: "Conakry",
  phone: "+224 622 00 00 00",
};

const defaultPharmacyStock: StockItem[] = [
  { id: 'STK-PARACET', name: 'Paracétamol 500mg', quantity: 85, unit: 'comprimés', threshold: 10 },
  { id: 'STK-AMOX', name: 'Amoxicilline 1g', quantity: 12, unit: 'comprimés', threshold: 10 },
  { id: 'STK-DOLI', name: 'Doliprane 1000mg', quantity: 0, unit: 'comprimés', threshold: 10 },
  { id: 'STK-ARTHE', name: 'Artémether-Luméfantrine', quantity: 40, unit: 'comprimés', threshold: 15 },
  { id: 'STK-QUIN', name: 'Quinine 400mg', quantity: 25, unit: 'comprimés', threshold: 10 },
  { id: 'STK-ORS', name: 'SRO ( sachets )', quantity: 60, unit: 'sachets', threshold: 20 },
  { id: 'STK-METRO', name: 'Métronidazole 250mg', quantity: 30, unit: 'comprimés', threshold: 10 },
  { id: 'STK-VITK', name: 'Vitamine K injectable', quantity: 8, unit: 'ampoules', threshold: 5 },
];

const AppContext = createContext<AppState | undefined>(undefined);

// Helper for LocalStorage
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.error(`[LocalStorage] Erreur de lecture pour "${key}":`, error);
      return initialValue;
    }
  });

  // CORRECTIF (bugs de mises à jour groupées) : la forme fonctionnelle est
  // transmise TELLE QU'ELLE à React, qui chaîne correctement les updates
  // consécutives d'un même handler (ex : création de plusieurs ordres d'un coup,
  // paiement de plusieurs articles à la caisse). L'ancienne implémentation
  // évaluait la fonction sur une valeur périmée → seule la dernière écriture
  // survivait.
  const setValue = (value: T | ((val: T) => T)) => {
    setStoredValue(prev => (value instanceof Function ? value(prev) : value));
  };

  // Persistance automatique à chaque changement d'état.
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`[LocalStorage] Erreur d'écriture pour "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
}

const defaultPatients: Patient[] = [
  { id: 'P001', name: 'Jean Dupont', age: 45, gender: 'M', phone: '06 12 34 56 78', neighborhood: 'Almadies', city: 'Dakar', arrivalTime: new Date().toISOString(), status: 'waiting_consultation', targetService: 'general', consultationFeePaid: true, history: [] },
  { id: 'P002', name: 'Marie Curie', age: 32, gender: 'F', arrivalTime: new Date().toISOString(), status: 'waiting_payment', targetService: 'cardiologie', consultationFeePaid: false, history: [] },
  { 
    id: 'P003', name: 'Aminata Sow', age: 28, gender: 'F', arrivalTime: new Date().toISOString(), status: 'consultation', targetService: 'gynecologie', consultationFeePaid: true, history: [],
    bloodGroup: 'O', rhFactor: '+',
    gynecoTriage: { motifPrincipal: 'Suivi de grossesse', situationObstetricale: 'Grossesse en cours', grossessesAnterieures: 1, parites: 0, urgence: false, referee: false, typeAdmission: 'Consultation externe' },
    medicalRecords: [
      { id: 'M001', date: '2026-03-15T10:00:00Z', type: 'cpn1', summary: 'CPN 1 réalisée à 10 SA', details: { poids: 65, ta: '110/70', bcf: 145 } },
      { id: 'M002', date: '2026-04-12T09:30:00Z', type: 'suivi', summary: 'Suivi mensuel (14 SA)', details: { poids: 66, ta: '115/75', bcf: 140, maf: 'Présents', hu: 12 } }
    ]
  },
  { 
    id: 'P004', name: 'Leo Martin', age: 2, gender: 'M', arrivalTime: new Date().toISOString(), status: 'waiting_consultation', targetService: 'pediatrie', consultationFeePaid: true, history: [],
    companionName: 'Sophie Martin', companionPhone: '06 98 76 54 32',
    medicalRecords: [
      { id: 'M003', date: '2025-10-10T09:00:00Z', type: 'vaccination', summary: 'Vaccin ROR', details: { vaccin: 'ROR', age: '1 an', reaction: 'Aucune' } },
      { id: 'M004', date: '2026-01-20T14:00:00Z', type: 'croissance', summary: 'Visite 18 mois', details: { poids: '11 kg', taille: '80 cm', PC: '48 cm', developpement: 'Marche acquise' } }
    ]
  }
];

const defaultOrders: Order[] = [
  { id: 'ORD-001', patientId: 'P001', type: 'pharmacy', details: 'Paracetamol 500mg, Amoxicilline 1g', status: 'pending', fee: 12000, date: new Date().toISOString(), prescribedBy: 'Dr. House' }
];

export function AppProvider({ children }: { children: ReactNode }) {
  const [isSetup, setSetup] = useLocalStorage<boolean>('hospi_isSetup', false);
  const [architectureMode, setArchitectureMode] = useLocalStorage<ArchitectureMode>('hospi_architectureMode', 'clinic');
  const [activeModules, setActiveModules] = useLocalStorage<Record<ModuleType, boolean>>('hospi_activeModules', defaultModules);
  const [currentUser, setCurrentUser] = useLocalStorage<User | null>('hospi_currentUser', null);
  const [users, setUsers] = useLocalStorage<User[]>('hospi_users', []);
  
  const [patients, setPatients] = useLocalStorage<Patient[]>('hospi_patients', defaultPatients);
  const [consultations, setConsultations] = useLocalStorage<Consultation[]>('hospi_consultations', []);
  const [orders, setOrders] = useLocalStorage<Order[]>('hospi_orders', defaultOrders);
  const [purchaseOrders, setPurchaseOrders] = useLocalStorage<PurchaseOrder[]>('hospi_purchaseOrders', []);
  const [maintenanceQuotes, setMaintenanceQuotes] = useLocalStorage<MaintenanceQuote[]>('hospi_maintenanceQuotes', []);
  const [payments, setPayments] = useLocalStorage<Payment[]>('hospi_payments', []);
  const [serviceBudgets, setServiceBudgets] = useLocalStorage<ServiceBudgets>('hospi_serviceBudgets', defaultServiceBudgets);
  const [pharmacyStock, setPharmacyStock] = useLocalStorage<StockItem[]>('hospi_pharmacyStock', defaultPharmacyStock);
  const [hospitalProfile, setHospitalProfile] = useLocalStorage<HospitalProfile>('hospi_hospitalProfile', defaultHospitalProfile);

  // ── Migration du schéma localStorage ─────────────────────────────────────────
  // Garantit la compatibilité des données persistées entre versions de l'app :
  // normalise les collections existantes et complète les nouvelles collections
  // (users, budgets, stock) avec leurs valeurs par défaut.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SCHEMA_VERSION_KEY);
      const version = raw ? Number(raw) : 0;
      if (version >= SCHEMA_VERSION) return;

      // Session antérieure au registre d'utilisateurs (v1) : sans mot de passe
      // enregistré, elle n'est plus authentifiable → déconnexion propre.
      setCurrentUser(prev => (prev && !prev.passwordHash ? null : prev));

      // Normalisation des patients (champs ajoutés après coup).
      setPatients(prev => prev.map(p => ({
        ...p,
        history: Array.isArray(p.history) ? p.history : [],
        medicalRecords: Array.isArray(p.medicalRecords) ? p.medicalRecords : [],
      })));

      // Complète les budgets manquants sans écraser les valeurs personnalisées.
      setServiceBudgets(prev => ({ ...defaultServiceBudgets, ...prev }));

      // Complète le profil d'établissement sans écraser les valeurs personnalisées.
      setHospitalProfile(prev => ({ ...defaultHospitalProfile, ...prev }));

      // Fusion du stock : conserve les quantités existantes, ajoute les nouveaux articles.
      setPharmacyStock(prev => {
        if (!Array.isArray(prev) || prev.length === 0) return defaultPharmacyStock;
        return defaultPharmacyStock.map(def => {
          const existing = prev.find(it => it.id === def.id);
          return existing ? { ...def, quantity: existing.quantity } : def;
        });
      });

      window.localStorage.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION));
      console.info(`[Hospi] Schéma localStorage migré v${version} → v${SCHEMA_VERSION}`);
    } catch (error) {
      console.error('[Hospi] Échec de la migration du schéma localStorage :', error);
    }
  // Exécuter une seule fois au démarrage.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleModule = (mod: ModuleType) => setActiveModules(prev => ({ ...prev, [mod]: !prev[mod] }));
  const login = (user: User) => setCurrentUser(user);
  const logout = () => setCurrentUser(null);
  const registerUser = (user: User) => {
    setUsers(prev => [...prev.filter(u => u.id !== user.id), user]);
    setCurrentUser(user);
  };
  const findUserByName = (name: string) =>
    users.find(u => u.name.trim().toLowerCase() === name.trim().toLowerCase());
  const getUserById = (id: string) => users.find(u => u.id === id);
  const addPatient = (patient: Patient) => setPatients(prev => [...prev, patient]);
  const updatePatient = (id: string, updates: Partial<Patient>) => setPatients(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  const addConsultation = (consultation: Consultation) => setConsultations(prev => [...prev, consultation]);
  const addOrder = (order: Order) => setOrders(prev => [...prev, order]);
  const updateOrder = (id: string, updates: Partial<Order>) => setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  const completeOrder = (id: string) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;
    updateOrder(id, { status: 'completed' });
    // Accès direct : clôture du dossier quand TOUS les examens du patient sont exécutés
    const patient = patients.find(p => p.id === order.patientId);
    if (patient?.admissionType === 'exam_direct') {
      const remaining = orders.some(o => o.patientId === patient.id && o.id !== id && o.status !== 'completed');
      if (!remaining) {
        updatePatient(patient.id, { status: 'treated' });
      }
    }
  };
  const addPurchaseOrder = (po: PurchaseOrder) => setPurchaseOrders(prev => [...prev, po]);
  const updatePurchaseOrder = (id: string, updates: Partial<PurchaseOrder>) => setPurchaseOrders(prev => prev.map(po => po.id === id ? { ...po, ...updates } : po));
  const addMaintenanceQuote = (mq: MaintenanceQuote) => setMaintenanceQuotes(prev => [...prev, mq]);
  const updateMaintenanceQuote = (id: string, updates: Partial<MaintenanceQuote>) => setMaintenanceQuotes(prev => prev.map(mq => mq.id === id ? { ...mq, ...updates } : mq));
  const addPayment = (payment: Payment) => setPayments(prev => [...prev, payment]);
  const updateStockItem = (id: string, updates: Partial<StockItem>) =>
    setPharmacyStock(prev => prev.map(it => it.id === id ? { ...it, ...updates } : it));
  const resetAllData = () => {
    const keysToRemove = [
      SCHEMA_VERSION_KEY,
      'hospi_isSetup', 'hospi_architectureMode', 'hospi_activeModules', 'hospi_currentUser', 'hospi_users',
      'hospi_patients', 'hospi_consultations', 'hospi_orders', 'hospi_purchaseOrders',
      'hospi_maintenanceQuotes', 'hospi_payments', 'hospi_serviceBudgets', 'hospi_pharmacyStock', 'hospi_hospitalProfile',
    ];
    keysToRemove.forEach(k => window.localStorage.removeItem(k));
    window.location.reload();
  };

  return (
    <AppContext.Provider value={{
      isSetup, setSetup, architectureMode, setArchitectureMode, activeModules, toggleModule, setActiveModules,
      currentUser, users, login, logout, registerUser, findUserByName, getUserById,
      patients, addPatient, updatePatient,
      consultations, addConsultation,
      orders, addOrder, updateOrder, completeOrder,
      purchaseOrders, addPurchaseOrder, updatePurchaseOrder,
      maintenanceQuotes, addMaintenanceQuote, updateMaintenanceQuote,
      payments, addPayment,
      serviceBudgets, setServiceBudgets,
      pharmacyStock, updateStockItem, setPharmacyStock,
      hospitalProfile, setHospitalProfile,
      resetAllData
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
