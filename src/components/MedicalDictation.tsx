import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2, X, Trash2, AlertCircle, ShieldCheck, ArrowLeft, Wand2, CheckCircle2, Clock, Play, Pause, FileAudio, Pill, TestTube, Crosshair, Syringe, ClipboardList } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { isAiConfigured, generateText, extractJsonObject, getProviderLabel, transcribeAudio } from '../lib/ai';
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
  pageName: string;
  schema: Record<string, string>;
  enableOrders?: boolean;
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

type Phase = 'idle' | 'recording' | 'recorded' | 'transcribing' | 'analyzing' | 'preview';

/**
 * Dictée médicale — ENREGISTREMENT AUDIO PUIS TRANSCRIPTION IA :
 * 1. Le médecin enregistre sa voix (MediaRecorder, 100% local, aucun serveur)
 * 2. Il peut écouter son enregistrement (lecteur audio intégré)
 * 3. Il clique « Transcrire » → l'IA convertit l'audio en texte
 * 4. Il clique « Analyser » → l'IA structure en champs + actes
 * 5. Aperçu validable avant application
 */
export function MedicalDictation({ open, onClose, pageName, schema, enableOrders = false, onApply }: MedicalDictationProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, string> | null>(null);
  const [ordersAnalysis, setOrdersAnalysis] = useState<DictatedOrders>(EMPTY_ORDERS);
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Chronomètre pendant l'enregistrement
  useEffect(() => {
    if (phase !== 'recording') return;
    const t = window.setInterval(() => setElapsed(s => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  // Nettoyage à la fermeture
  useEffect(() => {
    if (!open) {
      stopEverything();
      setError('');
    }
  }, [open]);

  const stopEverything = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setPhase('idle');
    setAudioUrl(null);
    setAudioBlob(null);
    setTranscript('');
    setAnalysis(null);
    setOrdersAnalysis(EMPTY_ORDERS);
    setDeselected(new Set());
    setElapsed(0);
  }, [audioUrl]);

  // ── ÉTAPE 1 : ENREGISTRER L'AUDIO (100% local, MediaRecorder) ──
  const startRecording = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[Dictée] ✓ Micro autorisé — démarrage de l\'enregistrement');

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      // Bitrate optimisé pour la parole : 16kbps = fichier léger = upload rapide
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 16000 });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setPhase('recorded');
        console.log('[Dictée] ✓ Enregistrement terminé:', (blob.size / 1024).toFixed(0), 'KB');
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setElapsed(0);
      setPhase('recording');
      console.log('[Dictée] 🎙️ Enregistrement en cours...');
    } catch (err) {
      console.error('[Dictée] Erreur micro:', err);
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError') {
        setError("🔒 Micro refusé — cliquez sur le cadenas 🔒 dans la barre d'adresse → Microphone → Autoriser, puis rechargez.");
      } else if (name === 'NotFoundError') {
        setError("🎤 Aucun micro détecté. Vous pouvez taper votre dictée ci-dessous.");
      } else {
        setError("⚠️ Impossible d'accéder au micro. Vous pouvez taper votre dictée ci-dessous.");
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // ── ÉTAPE 3 : TRANSCRIRE L'AUDIO AVEC L'IA ──
  const doTranscribe = useCallback(async () => {
    if (!audioBlob) return;
    setPhase('transcribing');
    setError('');
    try {
      console.log('[Dictée] 📤 Envoi de l\'audio à l\'IA...');
      const text = await transcribeAudio(audioBlob);
      console.log('[Dictée] ✓ Transcription:', text.slice(0, 100));
      setTranscript(text);
      setPhase('idle'); // retour au mode édition avec texte pré-rempli
    } catch (err) {
      console.error('[Dictée] Erreur transcription:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`⚠️ Transcription IA échouée (${msg.slice(0, 120)}). Vous pouvez écouter l'audio et taper le texte manuellement ci-dessous.`);
      setPhase('recorded'); // garder l'audio pour réessayer ou taper manuellement
    }
  }, [audioBlob]);

  // ── ÉTAPE 4 : ANALYSER LE TEXTE ──
  const analyze = async () => {
    if (!transcript.trim()) return;
    setPhase('analyzing');
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
      console.log('[Dictée] Réponse IA:', raw.slice(0, 200));
      const parsed = extractJsonObject(raw);
      if (!parsed) throw new Error('Format de réponse inattendu (pas de JSON)');

      const clean: Record<string, string> = {};
      const champs = parsed.champs;
      if (champs && typeof champs === 'object') {
        Object.entries(champs as Record<string, unknown>).forEach(([k, v]) => {
          if (typeof v === 'string' && v.trim() && k in schema) clean[k] = v.trim();
        });
      }
      const orders = enableOrders ? parseOrders(parsed) : EMPTY_ORDERS;
      const nbChamps = Object.keys(clean).length;
      const nbActes = orders.medications.length + orders.labTests.length + orders.imagingExams.length + orders.nursingCare.length;
      if (nbChamps === 0 && nbActes === 0) {
        setError("Aucun élément exploitable identifié. Complétez le texte et réessayez.");
        setPhase('idle');
        return;
      }
      setAnalysis(clean);
      setOrdersAnalysis(orders);
      setDeselected(new Set());
      setPhase('preview');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Erreur d'analyse IA : ${msg.slice(0, 150)} — le texte est conservé, réessayez.`);
      setPhase('idle');
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
  const selectedOrders = ordersAnalysis ? countOrders({
    medications: ordersAnalysis.medications.filter((_, i) => !deselected.has(`pharm:${i}`)),
    labTests: ordersAnalysis.labTests.filter((_, i) => !deselected.has(`lab:${i}`)),
    imagingExams: ordersAnalysis.imagingExams.filter((_, i) => !deselected.has(`ima:${i}`)),
    nursingCare: ordersAnalysis.nursingCare.filter((_, i) => !deselected.has(`nurse:${i}`)),
  }) : 0;

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
    stopEverything();
    onClose();
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const formatGnf = (n: number) => new Intl.NumberFormat('fr-GN', { maximumFractionDigits: 0 }).format(n) + ' FG';
  const itemClass = (key: string) => `flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${deselected.has(key) ? 'border-stone-200 bg-stone-50 opacity-60' : 'border-indigo-200 bg-indigo-50/50'}`;

  if (!open) return null;

  // Grouper les champs du schéma par catégorie pour le guide
  const fieldGuide = Object.entries(schema).map(([key, desc]) => ({
    key,
    desc,
    filled: Boolean(transcript && analysis?.[key]),
  }));

  return (
    <div className="fixed inset-0 z-[100] bg-stone-950/60 backdrop-blur-md p-2 md:p-4 flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl max-h-[94vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">

        <div className="p-4 border-b border-stone-100 bg-gradient-to-r from-indigo-50/50 to-white flex items-center justify-between shrink-0">
          <div className="flex items-center">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 mr-3 shadow-glow">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-stone-900">Dictée Médicale {enableOrders && <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">— contrôle total</span>}</h2>
              <p className="text-xs text-stone-500">{pageName} — enregistrez, écoutez, transcrivez puis analysez</p>
            </div>
          </div>
          <Button variant="ghost" onClick={onClose} className="rounded-full w-10 h-10 p-0 text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* ═══ CONTENU : 2 colonnes (guide des champs + enregistrement) ═══ */}
        <div className="flex-1 flex overflow-hidden">

          {/* ── COLONNE GAUCHE : Guide des champs à mentionner ── */}
          {phase !== 'preview' && (
            <aside className="hidden lg:flex w-80 xl:w-96 border-r border-stone-100 bg-stone-50/50 flex-col shrink-0">
              <div className="p-4 border-b border-stone-100">
                <h3 className="text-section flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-indigo-600" />
                  À mentionner dans votre dictée
                </h3>
                <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">
                  Guide des {fieldGuide.length} champs — dictez ceux qui s'appliquent, l'IA les remplira.
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {fieldGuide.map(({ key, desc }) => (
                  <div
                    key={key}
                    className={`flex items-start gap-2.5 px-3 py-2 rounded-xl text-[13px] leading-snug transition-colors ${
                      key.startsWith('atcd') ? 'bg-amber-50/60' :
                      key.includes('temperature') || key.includes('tension') || key.includes('pouls') || key.includes('poids') || key.includes('taille') || key.includes('spo2') ? 'bg-rose-50/50' :
                      key.includes('diagnos') ? 'bg-emerald-50/50' :
                      key.includes('orientation') || key.includes('hospitalisation') ? 'bg-purple-50/50' :
                      'bg-white/60'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      key.startsWith('atcd') ? 'bg-amber-400' :
                      key.includes('temperature') || key.includes('tension') || key.includes('pouls') || key.includes('poids') || key.includes('taille') || key.includes('spo2') ? 'bg-rose-400' :
                      key.includes('diagnos') ? 'bg-emerald-400' :
                      key.includes('orientation') || key.includes('hospitalisation') ? 'bg-purple-400' :
                      'bg-stone-300'
                    }`} />
                    <span className="text-stone-600 font-medium">{desc}</span>
                  </div>
                ))}
                {enableOrders && (
                  <div className="pt-2 mt-2 border-t border-stone-200/60 space-y-1">
                    <p className="text-micro px-3 pt-1">Actes & prescriptions (si nécessaire)</p>
                    {['💊 Médicaments (dose, fréquence, durée)', '🧪 Analyses (NFS, goutte épaisse...)', '🩻 Imagerie (écho, radio...)', '💉 Soins infirmiers'].map(label => (
                      <div key={label} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-blue-50/40 text-[13px] text-stone-600 font-medium">
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          )}

          {/* ── COLONNE DROITE : Enregistrement + transcription ── */}
          <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${phase === 'preview' ? 'w-full' : ''}`}>

          {/* ── PHASE : ÉDITION (enregistrement + transcription + texte) ── */}
          {(phase === 'idle' || phase === 'recording' || phase === 'recorded' || phase === 'transcribing') && (
            <>
              {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start animate-in fade-in duration-200">
                  <AlertCircle className="w-4.5 h-4.5 mr-2.5 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              {/* Zone d'enregistrement */}
              <div className="flex flex-col items-center py-6 border-2 border-dashed border-stone-200 rounded-3xl bg-stone-50/50 space-y-4">
                {phase === 'recording' ? (
                  <>
                    <div className="relative">
                      <span className="absolute inset-0 rounded-full bg-red-400/30 animate-ping" />
                      <button
                        onClick={stopRecording}
                        className="relative w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-2xl shadow-red-500/30 grid place-items-center hover:scale-105 active:scale-95 transition-transform"
                        title="Arrêter l'enregistrement"
                      >
                        <Square className="w-9 h-9 fill-white" />
                      </button>
                    </div>
                    <p className="font-bold text-red-600 text-lg">Enregistrement en cours…</p>
                    <div className="flex items-center gap-3 text-sm text-stone-500">
                      <span className="font-mono font-bold text-red-500 text-xl">{formatTime(elapsed)}</span>
                      <span>· Parlez naturellement, tout est enregistré localement</span>
                    </div>
                    {/* Visualisation audio (barres animées) */}
                    <div className="flex items-end gap-1 h-10">
                      {[...Array(12)].map((_, i) => (
                        <span
                          key={i}
                          className="w-1.5 rounded-full bg-red-400"
                          style={{
                            height: `${8 + Math.random() * 28}px`,
                            animation: `floatY ${0.5 + Math.random() * 0.5}s ease-in-out infinite alternate`,
                            animationDelay: `${i * 0.08}s`,
                          }}
                        />
                      ))}
                    </div>
                  </>
                ) : phase === 'recorded' ? (
                  <>
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg grid place-items-center">
                      <FileAudio className="w-9 h-9" />
                    </div>
                    <p className="font-bold text-emerald-600 text-lg">Enregistrement terminé !</p>
                    {/* Lecteur audio */}
                    {audioUrl && (
                      <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
                        <audio ref={audioRef} src={audioUrl} controls className="w-full" />
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button onClick={() => void doTranscribe()} size="lg" className="btn-sheen bg-gradient-to-r from-indigo-600 to-violet-600 shadow-glow rounded-2xl">
                        <><Wand2 className="w-5 h-5 mr-2" /> Transcrire avec l'IA</>
                      </Button>
                      <Button onClick={startRecording} variant="outline" size="lg" className="rounded-2xl">
                        <Mic className="w-4 h-4 mr-2" /> Réenregistrer
                      </Button>
                    </div>
                    <p className="text-xs text-stone-400">Ou tapez directement votre dictée ci-dessous (même résultat).</p>
                  </>
                ) : phase === 'transcribing' ? (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                    <p className="font-semibold text-indigo-600">Transcription de votre audio par l'IA…</p>
                    <p className="text-xs text-stone-400">Cela peut prendre quelques secondes selon la durée de l'enregistrement</p>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => void startRecording()}
                      className="relative w-24 h-24 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-2xl shadow-indigo-600/30 grid place-items-center hover:scale-105 active:scale-95 transition-transform pulse-ring"
                      title="Démarrer l'enregistrement"
                    >
                      <Mic className="w-10 h-10" />
                    </button>
                    <p className="font-semibold text-stone-700 text-lg">Cliquez sur le micro et parlez</p>
                    <p className="text-sm text-stone-400 text-center max-w-sm">
                      L'audio est enregistré <strong>localement</strong> sur votre appareil.
                      Ensuite, l'IA le transcrira en texte, puis le structurera en dossier médical.
                    </p>
                  </>
                )}
              </div>

              {/* Zone de texte (transcription ou saisie manuelle) */}
              {phase !== 'transcribing' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-section">
                      Transcription {transcript && <span className="text-emerald-600 normal-case">✓ {transcript.split(/\s+/).length} mots</span>}
                    </label>
                    {transcript && (
                      <button onClick={() => setTranscript('')} className="text-xs text-stone-400 hover:text-red-600 flex items-center font-semibold">
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Effacer
                      </button>
                    )}
                  </div>
                  <textarea
                    value={transcript}
                    onChange={e => { setTranscript(e.target.value); setError(''); }}
                    placeholder={'Le texte de votre dictée apparaîtra ici après transcription IA.\n\nVous pouvez aussi taper ou coller votre texte directement — le bouton « Analyser » utilisera ce texte dans tous les cas.'}
                    className="w-full min-h-[160px] border-2 border-stone-200 rounded-2xl p-4 text-[15px] leading-relaxed focus:outline-none focus:ring-3 focus:ring-indigo-500/15 focus:border-indigo-500 bg-white/70 transition-all"
                  />
                  <p className="text-micro mt-2">IA : {getProviderLabel()} · le texte est modifiable avant analyse</p>
                </div>
              )}

              <div className="flex items-start text-xs text-stone-500 bg-stone-50 border border-stone-100 rounded-xl p-3">
                <ShieldCheck className="w-4 h-4 mr-2.5 text-emerald-600 shrink-0 mt-0.5" />
                L'audio reste sur votre appareil pendant l'enregistrement. La transcription est effectuée par l'IA ({getProviderLabel()}).
                Ne dictez aucune donnée d'identification du patient.
              </div>
            </>
          )}

          {/* ── PHASE : APERÇU ── */}
          {phase === 'preview' && analysis && (
            <div className="space-y-5">
              <div className="flex items-center p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-800">
                <CheckCircle2 className="w-5 h-5 mr-2.5 shrink-0" />
                <span>
                  <strong>{Object.keys(analysis).length} champ{Object.keys(analysis).length > 1 ? 's' : ''}</strong> de consultation
                  {enableOrders && countOrders(ordersAnalysis) > 0 && (
                    <> et <strong>{countOrders(ordersAnalysis)} acte{countOrders(ordersAnalysis) > 1 ? 's' : ''}</strong></>
                  )} identifiés. Vérifiez, <strong>décochez ce qui est erroné</strong>, puis appliquez.
                </span>
              </div>

              {Object.keys(analysis).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-section border-b border-stone-100 pb-2">Formulaire de consultation</h3>
                  {Object.entries(analysis).map(([key, value]) => (
                    <label key={`field-${key}`} className={itemClass(`field:${key}`)}>
                      <input type="checkbox" checked={!deselected.has(`field:${key}`)} onChange={() => toggleDeselected(`field:${key}`)} className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                      <div className="flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-stone-500">{schema[key]}</p>
                        <p className="text-sm text-stone-800 mt-0.5">{value}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {enableOrders && countOrders(ordersAnalysis) > 0 && (
                <div className="space-y-2">
                  <h3 className="text-section border-b border-stone-100 pb-2 pt-2">Actes & prescriptions (transmis aux services après paiement)</h3>
                  {ordersAnalysis.medications.map((m, i) => (
                    <label key={`pharm-${i}`} className={itemClass(`pharm:${i}`)}>
                      <input type="checkbox" checked={!deselected.has(`pharm:${i}`)} onChange={() => toggleDeselected(`pharm:${i}`)} className="mt-1 w-4 h-4 rounded text-indigo-600" />
                      <div className="flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center"><Pill className="w-3 h-3 mr-1" /> Ordonnance — médicament {i + 1}</p>
                        <p className="text-sm text-stone-800 mt-0.5">{formatMedication(m)}</p>
                      </div>
                    </label>
                  ))}
                  {ordersAnalysis.labTests.map((t, i) => (
                    <label key={`lab-${i}`} className={itemClass(`lab:${i}`)}>
                      <input type="checkbox" checked={!deselected.has(`lab:${i}`)} onChange={() => toggleDeselected(`lab:${i}`)} className="mt-1 w-4 h-4 rounded text-indigo-600" />
                      <div className="flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-purple-700 flex items-center"><TestTube className="w-3 h-3 mr-1" /> Bon de biologie</p>
                        <p className="text-sm text-stone-800 mt-0.5">{t}</p>
                      </div>
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 shrink-0">{formatGnf(PRICING_CATALOG.lab)}</Badge>
                    </label>
                  ))}
                  {ordersAnalysis.imagingExams.map((e, i) => (
                    <label key={`ima-${i}`} className={itemClass(`ima:${i}`)}>
                      <input type="checkbox" checked={!deselected.has(`ima:${i}`)} onChange={() => toggleDeselected(`ima:${i}`)} className="mt-1 w-4 h-4 rounded text-indigo-600" />
                      <div className="flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-cyan-700 flex items-center"><Crosshair className="w-3 h-3 mr-1" /> Bon d'imagerie</p>
                        <p className="text-sm text-stone-800 mt-0.5">{e.type}{e.region ? ` — ${e.region}` : ''}{e.indication ? ` (${e.indication})` : ''}</p>
                      </div>
                      <Badge variant="outline" className="bg-cyan-50 text-cyan-700 shrink-0">{formatGnf(PRICING_CATALOG.imagerie)}</Badge>
                    </label>
                  ))}
                  {ordersAnalysis.nursingCare.map((s, i) => (
                    <label key={`nurse-${i}`} className={itemClass(`nurse:${i}`)}>
                      <input type="checkbox" checked={!deselected.has(`nurse:${i}`)} onChange={() => toggleDeselected(`nurse:${i}`)} className="mt-1 w-4 h-4 rounded text-indigo-600" />
                      <div className="flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center"><Syringe className="w-3 h-3 mr-1" /> Soins infirmiers</p>
                        <p className="text-sm text-stone-800 mt-0.5">{s}</p>
                      </div>
                      <Badge variant="outline" className="bg-rose-50 text-rose-700 shrink-0">{formatGnf(PRICING_CATALOG.nursing)}</Badge>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        </div>{/* fin colonne droite / flex container */}

        {/* ── PIED ── */}
        <div className="p-4 border-t border-stone-100 bg-stone-50/50 flex flex-col-reverse sm:flex-row justify-between gap-3 shrink-0">
          {phase === 'preview' ? (
            <>
              <Button variant="outline" onClick={() => setPhase('idle')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Revenir à la dictée
              </Button>
              <Button onClick={apply} disabled={selectedFields + selectedOrders === 0} size="lg" className="btn-sheen bg-gradient-to-r from-emerald-600 to-teal-600 shadow-lg shadow-emerald-600/30 rounded-xl">
                <CheckCircle2 className="w-5 h-5 mr-2" />
                {selectedFields > 0 && selectedOrders > 0 && `Appliquer ${selectedFields} champ${selectedFields > 1 ? 's' : ''} et ${selectedOrders} acte${selectedOrders > 1 ? 's' : ''}`}
                {selectedFields > 0 && selectedOrders === 0 && `Appliquer ${selectedFields} champ${selectedFields > 1 ? 's' : ''}`}
                {selectedFields === 0 && selectedOrders > 0 && `Appliquer ${selectedOrders} acte${selectedOrders > 1 ? 's' : ''}`}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button
                onClick={() => void analyze()}
                disabled={!transcript.trim() || phase === 'analyzing' || phase === 'recording' || phase === 'transcribing'}
                size="lg"
                className="btn-sheen bg-gradient-to-r from-indigo-600 to-violet-600 shadow-glow rounded-xl"
              >
                {phase === 'analyzing' ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analyse en cours…</>
                ) : (
                  <><Wand2 className="w-5 h-5 mr-2" /> Analyser la dictée</>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
