import React, { createContext, useContext, useState, ReactNode, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAiConfigured, generateText, extractJsonObject } from '../lib/ai';
import { useToast } from '../components/Toast';

export type AIActionType = 'fill_form' | 'navigate' | 'speak';

export interface AIAction {
  type: AIActionType;
  payload?: unknown;
}

interface PageContext {
  name: string;
  schema: Record<string, string>;
  onAction: (action: AIAction) => void;
}

interface AIContextState {
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  responseMessage: string;
  currentPageName: string;
  startListening: () => void;
  stopListening: () => void;
  registerPage: (pageName: string, schema: Record<string, string>, onAction: (action: AIAction) => void) => void;
  unregisterPage: () => void;
}

const AIContext = createContext<AIContextState | undefined>(undefined);

/** Carte des routes de l'application, injectée dans le prompt (audit F2 :
 *  sans elle, l'IA devine les URLs et la navigation vocale échoue souvent). */
const APP_ROUTES = [
  ['tableau de bord', '/'],
  ['réception / accueil / admission', '/reception'],
  ['caisse / paiements', '/caisse'],
  ['médecin / consultation générale', '/doctor'],
  ['gynécologie / maternité', '/gyneco'],
  ['pédiatrie', '/pediatrie'],
  ['pharmacie', '/pharmacie'],
  ['laboratoire / biologie', '/labo'],
  ['imagerie / radiologie', '/imagerie'],
  ['soins infirmiers', '/infirmier'],
  ['finances / comptabilité', '/finance'],
  ['paramètres / configuration', '/settings'],
] as const;

// ── Voix : sélectionne la meilleure voix française disponible ──────────────
function getBestFrenchVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const fr = voices.filter(v => v.lang.startsWith('fr'));
  return (
    fr.find(v => v.name.includes('Google')) ||
    fr.find(v => v.name.includes('Natural') || v.name.includes('Neural')) ||
    fr.find(v => v.name.includes('Hortense') || v.name.includes('Julie') || v.name.includes('Paul')) ||
    fr[0] ||
    null
  );
}

export function AIProvider({ children }: { children: ReactNode }) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [responseMessage, setResponseMessage] = useState('');
  const [currentPageName, setCurrentPageName] = useState('');

  const navigate = useNavigate();
  const toast = useToast();
  const pageContextRef = useRef<PageContext | null>(null);
  // Référence à l'instance de reconnaissance active : permet un vrai arrêt
  // (stop()) tout en recréant une instance neuve à chaque écoute afin d'éviter
  // les états corrompus.
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Précharger les voix dès le montage
  useEffect(() => {
    const load = () => window.speechSynthesis.getVoices();
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // ── Synthèse vocale ────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (!text) return;
    setResponseMessage(text);

    // Annule tout ce qui pourrait parler déjà
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.pitch = 1.0;
    utterance.rate = 0.95;

    const voice = getBestFrenchVoice();
    if (voice) utterance.voice = voice;

    // Chrome bug : parfois speechSynthesis se met en pause sur des textes longs
    // On le force à continuer toutes les 10s
    const keepAlive = window.setInterval(() => {
      if (window.speechSynthesis.speaking) window.speechSynthesis.resume();
    }, 10000);

    utterance.onend = () => window.clearInterval(keepAlive);
    utterance.onerror = () => window.clearInterval(keepAlive);

    window.speechSynthesis.speak(utterance);
  }, []);

  // ── Appel Gemini ──────────────────────────────────────────────────────────
  const processCommand = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setIsProcessing(true);

    if (!isAiConfigured) {
      speak('IA non configurée.');
      setIsProcessing(false);
      return;
    }

    try {
      const pageInfo = pageContextRef.current;

      const prompt = `Tu es un assistant de saisie pour un logiciel médical.
Page active : ${pageInfo?.name ?? 'inconnue'}
Champs disponibles : ${JSON.stringify(pageInfo?.schema ?? {})}
Routes de l'application (pour l'action navigate) : ${APP_ROUTES.map(([label, path]) => `${path} (${label})`).join(', ')}
Commande utilisateur : "${text}"

Renvoie UNIQUEMENT du JSON brut (pas de markdown) avec ce schéma :
{"actions":[
  {"type":"navigate","payload":"/url"},
  {"type":"fill_form","payload":{"champ":"valeur"}},
  {"type":"speak","payload":"confirmation courte"}
]}
RÈGLES :
- N'inclus que les actions pertinentes.
- Pour navigate, utilise EXACTEMENT une des routes listées ci-dessus.
- Pour fill_form, n'utilise que des clés présentes dans « Champs disponibles ».
- "speak" : phrase très courte, jamais de question.
- Si la commande est incompréhensible, renvoie {"actions":[]}.`;

      const rawText = await generateText(prompt);

      console.log('[AI] Réponse brute IA:', rawText);

      // Extraction robuste du JSON même si Gemini l'entoure de markdown
      const parsed = extractJsonObject(rawText);
      if (!parsed) {
        console.error('[AI] Aucun JSON trouvé dans la réponse:', rawText);
        speak('Réponse incompréhensible. Réessayez.');
        setIsProcessing(false);
        return;
      }

      const actions = parsed.actions;
      if (Array.isArray(actions)) {
        for (const action of (actions as AIAction[])) {
          if (action.type === 'speak' && typeof action.payload === 'string') {
            speak(action.payload);
          } else if (action.type === 'navigate' && typeof action.payload === 'string') {
            navigate(action.payload);
          } else if (action.type === 'fill_form' && pageInfo?.onAction) {
            pageInfo.onAction(action);
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[AI] Erreur processCommand:', message);
      speak('Erreur de traitement. Réessayez.');
    } finally {
      setIsProcessing(false);
    }
  }, [speak, navigate]);


  // ── Reconnaissance vocale : nouvelle instance à chaque écoute ─────────────
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.error('Reconnaissance vocale non supportée. Utilisez Chrome ou Edge.');
      return;
    }

    const recognition = new SR();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setIsListening(false);
      // Traitement asynchrone sans bloquer onresult
      window.setTimeout(() => { void processCommand(text); }, 0);
    };

    recognition.onerror = (e: SpeechRecognitionErrorEventLike) => {
      console.error('[AIContext] SpeechRecognition error:', e.error);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    setTranscript('');
    setResponseMessage('');
    recognitionRef.current = recognition;
    recognition.start();
  }, [processCommand]);

  const stopListening = useCallback(() => {
    // Arrêt réel de l'écoute via la référence à l'instance active.
    try {
      recognitionRef.current?.stop();
    } catch (err) {
      console.warn('[AIContext] Erreur à l\'arrêt de la reconnaissance :', err);
    }
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const registerPage = useCallback((name: string, schema: Record<string, string>, onAction: (a: AIAction) => void) => {
    pageContextRef.current = { name, schema, onAction };
    setCurrentPageName(name);
  }, []);

  const unregisterPage = useCallback(() => {
    pageContextRef.current = null;
    setCurrentPageName('');
  }, []);

  return (
    <AIContext.Provider value={{
      isListening,
      isProcessing,
      transcript,
      responseMessage,
      currentPageName,
      startListening,
      stopListening,
      registerPage,
      unregisterPage,
    }}>
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAI must be used within AIProvider');
  return ctx;
}
