import React, { useState } from 'react';
import { Mic, MicOff, Loader2, X, HelpCircle, Bot, ChevronUp } from 'lucide-react';
import { useAI } from '../context/AIContext';
import { motion, AnimatePresence } from 'framer-motion';

// Exemples de commandes par page
const PAGE_HINTS: Record<string, string[]> = {
  'Réception (Admission)': [
    '« Enregistre Mamadou Diallo, 34 ans, masculin »',
    '« Oriente vers la gynécologie »',
    '« Téléphone : 622 00 00 00 »',
  ],
  'Médecin (Consultation)': [
    '« Ouvre la dictée »',
    '« Le motif est fièvre et céphalées depuis 3 jours »',
    '« Diagnostic retenu : paludisme simple »',
    '« Température 38,5, tension 12 sur 8 »',
  ],
  'Gynécologie-Obstétrique': [
    '« Ouvre la dictée »',
    '« Motif : suivi de grossesse »',
    '« Diagnostic : grossesse évolutive »',
  ],
  'Pédiatrie': [
    '« Ouvre la dictée »',
    '« Motif : fièvre chez un enfant de 2 ans »',
    '« Poids 11 kilos, température 39 »',
  ],
  'Caisse Centrale': [
    '« Sélectionne le patient Jean Dupont »',
    '« Mode de paiement : Orange Money »',
    '« Applique l\'assurance NSIA »',
  ],
  'Pharmacie Interne': [
    '« Traite la première ordonnance »',
    '« Ouvre une demande de réapprovisionnement »',
  ],
  'Laboratoire de Biologie': [
    '« Traite le premier bon d\'analyse »',
    '« Signale une panne sur l\'automate »',
  ],
  "Centre d'Imagerie Médicale": [
    '« Ouvre le premier examen en attente »',
    '« Titre : Échographie abdomino-pelvienne »',
    '« Conclusion : pas d\'anomalie détectée »',
  ],
  'Soins Infirmiers': [
    '« Valide le premier soin en attente »',
    '« Compte rendu : soin bien supporté »',
  ],
};

const DEFAULT_HINTS = [
  '« Va à la réception »',
  '« Ouvre la caisse »',
  '« Affiche les statistiques »',
];

export function AIAssistant() {
  const {
    isListening,
    isProcessing,
    startListening,
    stopListening,
    transcript,
    responseMessage,
    currentPageName,
  } = useAI();

  const [showHints, setShowHints] = useState(false);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);

  const hints = PAGE_HINTS[currentPageName] ?? DEFAULT_HINTS;

  // Réouvre la bulle dès qu'un nouveau message arrive
  React.useEffect(() => {
    if (transcript || responseMessage) setBubbleDismissed(false);
  }, [transcript, responseMessage]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

      {/* ── Response / Transcript Bubble ── */}
      <AnimatePresence>
        {!bubbleDismissed && (transcript || responseMessage) && (
          <motion.div
            key="bubble"
            initial={{ opacity: 0, y: 14, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            className="bg-white/95 backdrop-blur-xl shadow-2xl rounded-2xl p-4 w-80 text-sm border border-slate-100 ring-1 ring-slate-200/60"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block leading-none">
                    Assistant IA
                  </span>
                  {currentPageName && (
                    <span className="text-[10px] text-blue-500 font-medium leading-none">{currentPageName}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setBubbleDismissed(true)}
                className="text-slate-300 hover:text-slate-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Transcript */}
            {transcript && (
              <div className="mb-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
                  Vous
                </span>
                <p className="text-slate-700 italic leading-snug">« {transcript} »</p>
              </div>
            )}

            {/* AI Response */}
            {responseMessage && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl px-3 py-2 border border-blue-100">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-0.5">
                  IA Médicale
                </span>
                <p className="text-blue-900 font-medium leading-snug">{responseMessage}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hints Panel ── */}
      <AnimatePresence>
        {showHints && (
          <motion.div
            key="hints"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 290, damping: 24 }}
            className="bg-white/95 backdrop-blur-xl shadow-2xl rounded-2xl p-4 w-72 border border-slate-100 ring-1 ring-slate-200/60"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                {currentPageName ? `Commandes — ${currentPageName}` : 'Commandes vocales'}
              </span>
              <button onClick={() => setShowHints(false)} className="text-slate-300 hover:text-slate-500">
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>

            <ul className="space-y-1.5">
              {hints.map((h, i) => (
                <li
                  key={i}
                  className="bg-slate-50 rounded-lg px-3 py-2 text-slate-600 text-xs border border-slate-100 leading-snug"
                >
                  {h}
                </li>
              ))}
            </ul>

            <p className="text-[10px] text-slate-400 mt-3 text-center leading-relaxed">
              Cliquez sur le micro et parlez<br />naturellement en français 🇫🇷
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom Controls ── */}
      <div className="flex items-center gap-2.5">

        {/* Help button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setShowHints(v => !v)}
          title="Voir les commandes disponibles"
          className={`
            w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all border-2
            ${showHints
              ? 'bg-blue-50 border-blue-200 text-blue-600'
              : 'bg-white/90 backdrop-blur-sm border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200'
            }
          `}
        >
          <HelpCircle className="w-4 h-4" />
        </motion.button>

        {/* Mic Button */}
        <div className="relative">

          {/* Listening pulse rings */}
          {isListening && (
            <>
              <motion.div
                animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'easeOut' }}
                className="absolute inset-0 rounded-full bg-red-400"
              />
              <motion.div
                animate={{ scale: [1, 1.45, 1], opacity: [0.35, 0, 0.35] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'easeOut', delay: 0.25 }}
                className="absolute inset-0 rounded-full bg-red-300"
              />
            </>
          )}

          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.9 }}
            onClick={isListening ? stopListening : startListening}
            disabled={isProcessing}
            title={isListening ? "Arrêter l'écoute" : "Parler à l'assistant IA"}
            className={`
              relative flex items-center justify-center w-14 h-14 rounded-full shadow-xl transition-all duration-200
              ${isProcessing
                ? 'bg-slate-200 cursor-not-allowed'
                : isListening
                  ? 'bg-gradient-to-br from-red-500 to-rose-600 ring-4 ring-red-100'
                  : 'bg-gradient-to-br from-blue-500 to-indigo-600 ring-4 ring-blue-100 hover:ring-blue-200 hover:from-blue-600 hover:to-indigo-700'
              }
              text-white
            `}
          >
            {isProcessing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : isListening ? (
              <MicOff className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </motion.button>

          {/* Status pill */}
          <span className={`
            absolute -top-1 -right-1 text-[9px] font-black px-1.5 py-0.5 rounded-full border-2 border-white select-none
            ${isProcessing
              ? 'bg-amber-400 text-amber-900'
              : isListening
                ? 'bg-red-500 text-white'
                : 'bg-emerald-500 text-white'
            }
          `}>
            {isProcessing ? '⏳' : isListening ? '🎙' : 'IA'}
          </span>
        </div>
      </div>
    </div>
  );
}
