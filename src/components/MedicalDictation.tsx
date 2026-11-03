import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Loader2, X, Trash2, AlertCircle, ShieldCheck, ArrowLeft, Wand2, CheckCircle2, Clock, Pill, TestTube, Crosshair, Syringe } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { isAiConfigured, generateText, extractJsonObject, getProviderLabel } from '../lib/ai';
import { PRICING_CATALOG } from '../context/AppContext';

/** Médicament dicté (ordonnance). */
export interface DictatedMedication {
  medicament: string;
  dosage?: string;
  forme?: string;
  frequence?: string;
  duree?: string;
  instructions?: string;
}

/** Examen d'imagerie dicté. */
export interface DictatedImagingExam {
  type: string;
  region?: string;
  indication?: string;
}

/** Actes et prescriptions extraits de la dictée (contrôle vocal total). */
export interface DictatedOrders {
  medications: DictatedMedication[];
  labTests: string[];
  imagingExams: DictatedImagingExam[];
  nursingCare: string[];
}

const EMPTY_ORDERS: DictatedOrders = { medications: [], labTests: [], imagingExams: [], nursingCare: [] };

interface MedicalDictationProps {
  open: boolean;
  onClose: () => void;
  /** Nom de la page (affiché + transmis à l'IA comme contexte). */
  pageName: string;
  /** clé technique -> description française du champ (utilisée pour le prompt IA et l'aperçu). */
  schema: Record<string, string>;
  /** Actif : la dictée peut aussi créer ordonnances, bons labo/imagerie et soins infirmiers. */
  enableOrders?: boolean;
  /** Appelé avec les champs ET les actes validés par le médecin dans l'aperçu. */
  onApply: (fields: Record<string, string>, orders: DictatedOrders) => void;
}

/** Formatage d'un médicament dicté pour l'affichage et le détail de l'ordre. */
export function formatMedication(m: DictatedMedication): string {
  const parts = [
    `${m.medicament}${m.dosage ? ` ${m.dosage}` : ''}${m.forme ? ` ${m.forme}` : ''}`,
    m.frequence || m.duree ? `${m.frequence ?? ''}${m.frequence && m.duree ? ' pendant ' : ''}${m.duree ?? ''}`.trim() : '',
    m.instructions ? `(${m.instructions})` : '',
  ].filter(Boolean);
  return parts.join(' — ');
}

/** Conversion robuste de la réponse IA en actes validés. */
function parseOrders(parsed: Record<string, unknown>): DictatedOrders {
  const orders: DictatedOrders = { medications: [], labTests: [], imagingExams: [], nursingCare: [] };
  const asString = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

  if (Array.isArray(parsed.ordonnance)) {
    for (const m of parsed.ordonnance) {
      if (m && typeof m === 'object') {
        const med = m as Record<string, unknown>;
        const name = asString(med.medicament) || asString(med.nom) || asString(med.denomination);
        if (name) {
          orders.medications.push({
            medicament: name,
            dosage: asString(med.dosage) || undefined,
            forme: asString(med.forme) || undefined,
            frequence: asString(med.frequence) || asString(med.posologie) || undefined,
            duree: asString(med.duree) || asString(med.duree_traitement) || undefined,
            instructions: asString(med.instructions) || asString(med.observations) || undefined,
          });
        }
      } else if (typeof m === 'string' && m.trim()) {
        orders.medications.push({ medicament: m.trim() });
      }
    }
  }

  if (Array.isArray(parsed.laboratoire)) {
    for (const t of parsed.laboratoire) {
      const s = asString(t);
      if (s) orders.labTests.push(s);
    }
  }

  if (Array.isArray(parsed.imagerie)) {
    for (const im of parsed.imagerie) {
      if (im && typeof im === 'object') {
        const e = im as Record<string, unknown>;
        const type = asString(e.type) || asString(e.modalite) || asString(e.examen);
        if (type) {
          orders.imagingExams.push({
            type,
            region: asString(e.region) || asString(e.region_anatomique) || undefined,
            indication: asString(e.indication) || asString(e.renseignements) || undefined,
          });
        }
      } else if (typeof im === 'string' && im.trim()) {
        orders.imagingExams.push({ type: im.trim() });
      }
    }
  }

  if (Array.isArray(parsed.soins_infirmiers)) {
    for (const s of parsed.soins_infirmiers) {
      const v = asString(s);
      if (v) orders.nursingCare.push(v);
    }
  }

  return orders;
}

/**
 * Dictée médicale intelligente (contrôle vocal total) :
 * 1. Le médecin parle librement (dictée continue avec relance auto après silence),
 *    ou saisit/colle le texte manuellement (filet de sécurité).
 * 2. L'IA structure la dictée : champs du formulaire ET actes (ordonnance, labo,
 *    imagerie, soins infirmiers) — sans rien inventer.
 * 3. Aperçu : le médecin décoche tout élément erroné AVANT application.
 */
export function MedicalDictation({ open, onClose, pageName, schema, enableOrders = false, onApply }: MedicalDictationProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [interim, setInterim] = useState('');
  const [transcript, setTranscript] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Record<string, string> | null>(null);
  const [ordersAnalysis, setOrdersAnalysis] = useState<DictatedOrders>(EMPTY_ORDERS);
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recordingRef = useRef(false);

  // Chronomètre de dictée
  useEffect(() => {
    if (!isRecording) return;
    const t = window.setInterval(() => setElapsed(s => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    recordingRef.current = false;
    try { recognitionRef.current?.stop(); } catch { /* instance déjà arrêtée */ }
    recognitionRef.current = null;
    setIsRecording(false);
    setInterim('');
  }, []);

  // Nettoyage à la fermeture / démontage
  useEffect(() => {
    if (!open) {
      stopRecording();
      setError('');
    }
  }, [open, stopRecording]);
  useEffect(() => () => stopRecording(), [stopRecording]);

  // ── Diagnostic au démarrage : navigateur + IA ──
  const [browserSupported, setBrowserSupported] = useState(true);
  const [aiStatus, setAiStatus] = useState<'checking' | 'ready' | 'error'>('checking');

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setBrowserSupported(Boolean(SR));
    if (!SR) {
      setError("Reconnaissance vocale non supportée — utilisez Chrome ou Edge. Vous pouvez taper votre dictée manuellement ci-dessous (même résultat).");
    }
    if (isAiConfigured) {
      generateText("Réponds juste: OK")
        .then(() => setAiStatus('ready'))
        .catch(() => {
          setAiStatus('error');
          setError(prev => prev || "L'IA ne répond pas (crédits ou connexion). Saisie manuelle disponible ci-dessous.");
        });
    } else {
      setAiStatus('error');
      setError("IA non configurée (VITE_OPENROUTER_API_KEY). Saisie manuelle disponible ci-dessous.");
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError('');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError("🎙️ Reconnaissance vocale non supportée par ce navigateur. Utilisez CHROME ou EDGE. Vous pouvez aussi taper votre dictée ci-dessous (même résultat).");
      return;
    }

    // ── ÉTAPE 1 : Forcer la demande de permission micro ──
    // getUserMedia déclenche la popup "Autoriser le microphone" si elle
    // n'a jamais été affichée. Sans ça, SpeechRecognition échoue en silence.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // On relève immédiatement le stream (on ne veut pas enregistrer, juste la permission)
      stream.getTracks().forEach(t => t.stop());
      console.log('[Dictée] ✓ Permission microphone accordée');
    } catch (permErr: unknown) {
      const errName = permErr instanceof Error ? permErr.name : '';
      console.error('[Dictée] ✗ Permission refusée:', errName);
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setError("🔒 MICRO REFUSÉ — Cliquez sur l'icône cadenas 🔒 à gauche de l'URL → Microphone → Autoriser, puis rechargez la page et réessayez.");
      } else if (errName === 'NotFoundError') {
        setError("🎤 Aucun microphone détecté sur cet appareil. Branchez un micro ou utilisez la saisie manuelle ci-dessous.");
      } else {
        setError("⚠️ Impossible d'accéder au microphone (" + errName + "). Utilisez la saisie manuelle ci-dessous.");
      }
      return;
    }

    // ── ÉTAPE 2 : Démarrer la reconnaissance vocale ──
    setElapsed(0);
    recordingRef.current = true;

    try {
      const recognition = new SR();
      recognition.lang = 'fr-FR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log('[Dictée] ✓ Reconnaissance démarrée — parlez maintenant');
        setIsRecording(true);
        setHasResults(false);
        // Timeout : si aucun résultat après 8 secondes, avertir
        window.setTimeout(() => {
          if (!hasResults && recordingRef.current) {
            console.warn('[Dictée] ⚠️ 8s sans résultat — problème de connexion aux serveurs Google ?');
            setError(prev => prev || "⚠️ Aucune voix détectée après 8 secondes. Causes possibles : connexion lente vers les serveurs Google (la reconnaissance vocale envoie l'audio vers Google), micro mal sélectionné, ou parlez plus fort. Vous pouvez taper votre dictée manuellement ci-dessous.");
          }
        }, 8000);
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let finalText = '';
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const txt = res[0].transcript;
          if (res.isFinal) finalText += txt;
          else interimText += txt;
        }
        if (finalText.trim()) {
          console.log('[Dictée] FINAL:', finalText.trim().slice(0, 80));
          setTranscript(prev => (prev.trim() ? prev.trim() + ' ' : '') + finalText.trim());
        }
        if (interimText.trim()) setHasResults(true);
        setInterim(interimText);
      };

      recognition.onerror = (e: SpeechRecognitionErrorEventLike) => {
        console.error('[Dictée] Erreur:', e.error);
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          setError("🔒 Micro refusé — cliquez sur le cadenas 🔒 dans la barre d'adresse → Microphone → Autoriser → rechargez la page.");
          recordingRef.current = false;
          setIsRecording(false);
        } else if (e.error === 'no-speech') {
          // Pas grave : le silence déclenche un redémarrage automatique
          console.log('[Dictée] Silence détecté, redémarrage...');
        } else if (e.error === 'network') {
          setError("📡 Erreur réseau — la reconnaissance vocale nécessite une connexion internet (serveurs Google).");
          recordingRef.current = false;
          setIsRecording(false);
        } else if (e.error === 'audio-capture') {
          setError("🎤 Micro introuvable — vérifiez qu'il est branché et sélectionné comme entrée par défaut.");
          recordingRef.current = false;
          setIsRecording(false);
        }
      };

      recognition.onend = () => {
        if (recordingRef.current) {
          try { recognition.start(); console.log('[Dictée] Redémarrage auto'); } catch { /* déjà démarré */ }
          return;
        }
        setIsRecording(false);
        setInterim('');
      };

      recognitionRef.current = recognition;
      recognition.start();
      console.log('[Dictée] recognition.start() appelé');
    } catch (startErr) {
      console.error('[Dictée] Erreur au démarrage:', startErr);
      setError("⚠️ Impossible de démarrer la reconnaissance. Utilisez la saisie manuelle ci-dessous.");
      recordingRef.current = false;
    }
  }, []);

  const analyze = async () => {
    if (!transcript.trim()) return;
    // Audit F4 : l'instantané analysé ne doit plus évoluer — on coupe le micro.
    stopRecording();
    if (!isAiConfigured) {
      setError(`Aucun fournisseur IA configuré. Renseignez VITE_OPENROUTER_API_KEY dans le fichier .env. (Actif : ${getProviderLabel()})`);
      return;
    }
    setIsAnalyzing(true);
    setError('');
    try {
      const ordresSection = enableOrders ? `
ACTES ET PRESCRIPTIONS — si le médecin dicte des prescriptions ou des demandes d'examens, extrais-les dans les listes dédiées :
- "ordonnance" : liste de médicaments [{"medicament":"...","dosage":"...","forme":"...","frequence":"...","duree":"...","instructions":"..."}]
- "laboratoire" : liste des analyses demandées (ex: ["NFS","Goutte épaisse"])
- "imagerie" : liste d'examens [{"type":"Échographie","region":"abdomen","indication":"..."}]
- "soins_infirmiers" : liste des soins prescrits (ex: ["Pansement quotidien pendant 7 jours"])
Les prescriptions et demandes d'examens vont EXCLUSIVEMENT dans ces listes, jamais dans les champs de consultation.

ORIENTATION DU PATIENT (si les clés suivantes figurent dans les champs attendus) :
- "orientation" : le service de transfert dicté par le médecin, parmi : general (médecine générale), cardiologie, gynecologie, pediatrie, chirurgie. Ne remplis cette clé QUE si le médecin a explicitement dicté une orientation/transfert.
- "hospitalisation" : "oui" si le médecin décide d'hospitaliser le patient, "non" sinon (uniquement si la clé est demandée).` : '';

      const prompt = `Tu es un assistant de structuration de comptes-rendus médicaux dans un hôpital francophone (service : ${pageName}).
Le médecin a dicté son examen clinique en parlant librement. Extrais les informations et remplis les champs ci-dessous.

CHAMPS ATTENDUS (clé technique -> description) :
${Object.entries(schema).map(([k, d]) => `- ${k} : ${d}`).join('\n')}
${ordresSection}

DICTÉE DU MÉDECIN :
"""${transcript.trim()}"""

RÈGLES STRICTES :
1. Renseigne UNIQUEMENT les éléments dont l'information est EXPLICITEMENT présente dans la dictée. N'invente rien, n'interprète pas, ne complète pas par déduction.
2. Recopie fidèlement la terminologie médicale du médecin (corrige seulement ponctuation et orthographe).
3. Constantes vitales en valeurs simples, sans unité : température "38.5", tension "12/8" ou "120/80", pouls "92", poids "70", taille "175", SpO2 "98".
4. Les champs de texte libre doivent être des phrases médicales concises et informatives.
5. Si une information est ambiguë ou absente, omette-la.

Réponds UNIQUEMENT par un JSON valide, sans markdown : {"champs": {"clé": "valeur", ...}${enableOrders ? ', "ordonnance": [...], "laboratoire": [...], "imagerie": [...], "soins_infirmiers": [...]' : ''}}
Omette les clés sans contenu.`;

      const raw = await generateText(prompt);
      console.log('[Dictée] Réponse IA:', raw);
      const parsed = extractJsonObject(raw);
      if (!parsed) throw new Error('Format de réponse inattendu (pas de JSON)');

      // Champs de consultation
      const clean: Record<string, string> = {};
      const champs = parsed.champs;
      if (champs && typeof champs === 'object') {
        Object.entries(champs as Record<string, unknown>).forEach(([k, v]) => {
          if (typeof v === 'string' && v.trim() && k in schema) clean[k] = v.trim();
        });
      }

      // Actes et prescriptions
      const orders = enableOrders ? parseOrders(parsed) : EMPTY_ORDERS;
      const nbChamps = Object.keys(clean).length;
      const nbActes = orders.medications.length + orders.labTests.length + orders.imagingExams.length + orders.nursingCare.length;

      if (nbChamps === 0 && nbActes === 0) {
        setError("Aucun élément exploitable n'a été identifié dans la dictée. Complétez le texte et réessayez.");
        return;
      }

      setAnalysis(clean);
      setOrdersAnalysis(orders);
      setDeselected(new Set());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Dictée] Erreur analyse IA:', message);
      setError(`Erreur lors de l'analyse par l'IA : ${message.slice(0, 180)} — la dictée est conservée, réessayez.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleDeselected = (key: string) => {
    setDeselected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const countOrders = (o: DictatedOrders) => o.medications.length + o.labTests.length + o.imagingExams.length + o.nursingCare.length;
  const selectedFields = analysis ? Object.keys(analysis).filter(k => !deselected.has(`field:${k}`)).length : 0;
  const selectedOrders = ordersAnalysis
    ? countOrders({
        medications: ordersAnalysis.medications.filter((_, i) => !deselected.has(`pharm:${i}`)),
        labTests: ordersAnalysis.labTests.filter((_, i) => !deselected.has(`lab:${i}`)),
        imagingExams: ordersAnalysis.imagingExams.filter((_, i) => !deselected.has(`ima:${i}`)),
        nursingCare: ordersAnalysis.nursingCare.filter((_, i) => !deselected.has(`nurse:${i}`)),
      })
    : 0;

  const apply = () => {
    if (!analysis) return;
    const fields: Record<string, string> = {};
    Object.entries(analysis).forEach(([k, v]) => {
      if (!deselected.has(`field:${k}`)) fields[k] = v;
    });
    const orders: DictatedOrders = {
      medications: ordersAnalysis.medications.filter((_, i) => !deselected.has(`pharm:${i}`)),
      labTests: ordersAnalysis.labTests.filter((_, i) => !deselected.has(`lab:${i}`)),
      imagingExams: ordersAnalysis.imagingExams.filter((_, i) => !deselected.has(`ima:${i}`)),
      nursingCare: ordersAnalysis.nursingCare.filter((_, i) => !deselected.has(`nurse:${i}`)),
    };
    onApply(fields, orders);
    // Réinitialisation pour une prochaine dictée
    setAnalysis(null);
    setOrdersAnalysis(EMPTY_ORDERS);
    setTranscript('');
    setDeselected(new Set());
    onClose();
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const formatGnf = (n: number) => new Intl.NumberFormat('fr-GN', { maximumFractionDigits: 0 }).format(n) + ' FG';

  const itemClass = (key: string) =>
    `flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${deselected.has(key) ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-blue-200 bg-blue-50/50'}`;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm p-2 md:p-6 flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* En-tête */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-blue-50 mr-3">
              <Mic className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Dictée Médicale {enableOrders && <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">— contrôle total</span>}</h2>
              <p className="text-sm text-slate-500">{pageName} — parlez, l'IA remplit le formulaire {enableOrders && 'et crée les prescriptions'} pour vous</p>
            </div>
          </div>
          <Button variant="ghost" onClick={onClose} className="rounded-full w-10 h-10 p-0 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {!analysis ? (
          /* ══════════ PHASE 1 : DICTÉE ══════════ */
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start">
                <AlertCircle className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Indicateurs de diagnostic navigateur + IA */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${browserSupported ? 'text-emerald-600' : 'text-red-500'}`}>
              {browserSupported ? '● Micro OK' : '● Micro non supporté'}
            </span>
            <span className="text-stone-300">·</span>
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${aiStatus === 'ready' ? 'text-emerald-600' : aiStatus === 'checking' ? 'text-amber-500' : 'text-red-500'}`}>
              {aiStatus === 'ready' ? '● IA connectée' : aiStatus === 'checking' ? '● IA connexion...' : '● IA indisponible'}
            </span>
          </div>

          {/* Contrôle micro */}
            <div className="flex flex-col items-center py-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              {isRecording ? (
                <div className="relative">
                  <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-30" />
                  <button
                    onClick={stopRecording}
                    className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-xl flex items-center justify-center"
                    title="Arrêter la dictée"
                  >
                    <MicOff className="w-9 h-9" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={startRecording}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xl flex items-center justify-center hover:from-blue-600 hover:to-indigo-700 transition-all"
                  title="Démarrer la dictée"
                >
                  <Mic className="w-9 h-9" />
                </button>
              )}
              <p className="mt-3 font-medium text-slate-700">
                {isRecording ? 'Écoute en cours… parlez naturellement' : 'Cliquez sur le micro et dictez votre examen'}
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                {isRecording && (
                  <span className="flex items-center text-red-600 font-semibold">
                    <Clock className="w-3 h-3 mr-1" /> {formatTime(elapsed)}
                  </span>
                )}
                <span>● Dictée continue (l'écoute reprend après chaque pause)</span>
              </div>
            </div>

            {/* Transcription (éditable) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Transcription {isRecording && <span className="text-red-500">(en direct)</span>}
                </label>
                {transcript && (
                  <button onClick={() => setTranscript('')} className="text-xs text-slate-400 hover:text-red-600 flex items-center">
                    <Trash2 className="w-3 h-3 mr-1" /> Effacer
                  </button>
                )}
              </div>
              <div className="relative">
                <textarea
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                  placeholder={'Ex : « Le patient se plaint de fièvre et de céphalées depuis trois jours. Température 38,5, tension 12 sur 8… Je prescris paracétamol 1000 mg matin et soir pendant cinq jours, je demande une NFS et une goutte épaisse, ainsi qu\'une échographie abdominale, et des soins de pansement quotidien. Je retiens un paludisme simple. »\n\nVous pouvez aussi écrire ou coller le texte ici si le micro n\'est pas disponible.'}
                  className="w-full min-h-[180px] border border-slate-300 rounded-xl p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {isRecording && interim && (
                  <div className="absolute bottom-3 left-4 right-4 text-lg font-bold text-blue-700 pointer-events-none bg-blue-50/95 backdrop-blur rounded-xl px-4 py-3 border-2 border-blue-300 shadow-md animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <span className="animate-pulse inline-block w-2.5 h-5 bg-blue-500 rounded-sm mr-3 align-middle" />
                    {interim}
                  </div>
                )}
                {isRecording && !interim && !hasResults && (
                  <div className="absolute bottom-3 left-4 right-4 text-sm text-stone-500 pointer-events-none flex items-center gap-2.5 bg-white/80 rounded px-3 py-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                    À l'écoute… parlez distinctement dans le micro
                    <span className="text-stone-400 ml-auto">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                {transcript.trim() ? `${transcript.trim().split(/\s+/).length} mots — vous pouvez corriger le texte avant analyse` : 'La transcription apparaîtra ici automatiquement pendant que vous parlez.'}
                {' '}· IA : {getProviderLabel()}
              </p>
            </div>

            {/* Confidentialité */}
            <div className="flex items-start text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg p-3">
              <ShieldCheck className="w-4 h-4 mr-2 text-emerald-600 shrink-0 mt-0.5" />
              L'audio est transcrit par votre navigateur (Web Speech) puis structuré par l'IA ({getProviderLabel()}).
              Ne dictez aucune donnée d'identification du patient (nom, téléphone) — utilisez le dossier affiché.
            </div>
          </div>
        ) : (
          /* ══════════ PHASE 2 : APERÇU AVANT APPLICATION ══════════ */
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="flex items-center p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-800">
              <CheckCircle2 className="w-5 h-5 mr-2 shrink-0" />
              <span>
                <strong>{Object.keys(analysis).length} champ{Object.keys(analysis).length > 1 ? 's' : ''}</strong> de consultation
                {enableOrders && countOrders(ordersAnalysis) > 0 && (
                  <> et <strong>{countOrders(ordersAnalysis)} acte{countOrders(ordersAnalysis) > 1 ? 's' : ''}/prescription{countOrders(ordersAnalysis) > 1 ? 's' : ''}</strong></>
                )} identifiés dans la dictée.
                Vérifiez, <strong>décochez ce qui est erroné</strong>, puis appliquez.
              </span>
            </div>

            {/* Champs de consultation */}
            {Object.keys(analysis).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Formulaire de consultation</h3>
                {Object.entries(analysis).map(([key, value]) => (
                  <label key={`field-${key}`} className={itemClass(`field:${key}`)}>
                    <input
                      type="checkbox"
                      checked={!deselected.has(`field:${key}`)}
                      onChange={() => toggleDeselected(`field:${key}`)}
                      className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{schema[key]}</p>
                      <p className="text-sm text-slate-800 mt-0.5">{value}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Actes et prescriptions */}
            {enableOrders && countOrders(ordersAnalysis) > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2 pt-2">Actes & prescriptions (transmis aux services après paiement)</h3>

                {ordersAnalysis.medications.map((m, i) => (
                  <label key={`pharm-${i}`} className={itemClass(`pharm:${i}`)}>
                    <input type="checkbox" checked={!deselected.has(`pharm:${i}`)} onChange={() => toggleDeselected(`pharm:${i}`)} className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
                    <div className="flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center"><Pill className="w-3 h-3 mr-1" /> Ordonnance — médicament {i + 1}</p>
                      <p className="text-sm text-slate-800 mt-0.5">{formatMedication(m)}</p>
                    </div>
                  </label>
                ))}

                {ordersAnalysis.labTests.map((t, i) => (
                  <label key={`lab-${i}`} className={itemClass(`lab:${i}`)}>
                    <input type="checkbox" checked={!deselected.has(`lab:${i}`)} onChange={() => toggleDeselected(`lab:${i}`)} className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
                    <div className="flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-purple-700 flex items-center"><TestTube className="w-3 h-3 mr-1" /> Bon de biologie</p>
                      <p className="text-sm text-slate-800 mt-0.5">{t}</p>
                    </div>
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 shrink-0">{formatGnf(PRICING_CATALOG.lab)}</Badge>
                  </label>
                ))}

                {ordersAnalysis.imagingExams.map((e, i) => (
                  <label key={`ima-${i}`} className={itemClass(`ima:${i}`)}>
                    <input type="checkbox" checked={!deselected.has(`ima:${i}`)} onChange={() => toggleDeselected(`ima:${i}`)} className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
                    <div className="flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-cyan-700 flex items-center"><Crosshair className="w-3 h-3 mr-1" /> Bon d'imagerie</p>
                      <p className="text-sm text-slate-800 mt-0.5">{e.type}{e.region ? ` — ${e.region}` : ''}{e.indication ? ` (${e.indication})` : ''}</p>
                    </div>
                    <Badge variant="outline" className="bg-cyan-50 text-cyan-700 shrink-0">{formatGnf(PRICING_CATALOG.imagerie)}</Badge>
                  </label>
                ))}

                {ordersAnalysis.nursingCare.map((s, i) => (
                  <label key={`nurse-${i}`} className={itemClass(`nurse:${i}`)}>
                    <input type="checkbox" checked={!deselected.has(`nurse:${i}`)} onChange={() => toggleDeselected(`nurse:${i}`)} className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
                    <div className="flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center"><Syringe className="w-3 h-3 mr-1" /> Soins infirmiers</p>
                      <p className="text-sm text-slate-800 mt-0.5">{s}</p>
                    </div>
                    <Badge variant="outline" className="bg-rose-50 text-rose-700 shrink-0">{formatGnf(PRICING_CATALOG.nursing)}</Badge>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pied : actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col-reverse sm:flex-row justify-between gap-3 shrink-0">
          {!analysis ? (
            <>
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button
                onClick={() => { void analyze(); }}
                disabled={!transcript.trim() || isAnalyzing}
                className="bg-blue-600 hover:bg-blue-700 shadow-md"
                size="lg"
              >
                {isAnalyzing ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analyse en cours…</>
                ) : (
                  <><Wand2 className="w-5 h-5 mr-2" /> Analyser la dictée</>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setAnalysis(null); setOrdersAnalysis(EMPTY_ORDERS); }}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Revenir à la dictée
              </Button>
              <Button
                onClick={apply}
                disabled={selectedFields + selectedOrders === 0}
                className="bg-emerald-600 hover:bg-emerald-700 shadow-md"
                size="lg"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                {selectedFields > 0 && selectedOrders > 0 && `Appliquer ${selectedFields} champ${selectedFields > 1 ? 's' : ''} et ${selectedOrders} acte${selectedOrders > 1 ? 's' : ''}`}
                {selectedFields > 0 && selectedOrders === 0 && `Appliquer ${selectedFields} champ${selectedFields > 1 ? 's' : ''}`}
                {selectedFields === 0 && selectedOrders > 0 && `Appliquer ${selectedOrders} acte${selectedOrders > 1 ? 's' : ''}`}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
