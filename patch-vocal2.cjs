const fs = require("fs");
let s = fs.readFileSync("src/components/MedicalDictation.tsx", "utf8");
const ok = (c, m) => { if (!c) { console.error("ÉCHEC " + m); process.exit(1); } };

// 1. Ajouter un état "noResults" pour le timeout
s = s.replace(
  "  const [isRecording, setIsRecording] = useState(false);",
  "  const [isRecording, setIsRecording] = useState(false);\n  const [hasResults, setHasResults] = useState(false);\n  const [recogDebug, setRecogDebug] = useState<string[]>([]);"
);
ok(s.includes("hasResults"), "états");

// 2. Ajouter la logique de timeout + debug dans startRecording
s = s.replace(
  `      recognition.onstart = () => {
        console.log('[Dictée] ✓ Reconnaissance démarrée — parlez maintenant');
        setIsRecording(true);
      };`,
  `      recognition.onstart = () => {
        console.log('[Dictée] ✓ Reconnaissance démarrée — parlez maintenant');
        setIsRecording(true);
        setHasResults(false);
        setRecogDebug(prev => [...prev.slice(-5), '✓ Démarré — parlez']);
        // Timeout : si aucun résultat après 8 secondes, avertir
        window.setTimeout(() => {
          if (!hasResults && recordingRef.current) {
            setRecogDebug(prev => [...prev.slice(-5), '⚠️ 8s sans résultat — vérifiez connexion']);
            setError(prev => prev || "⚠️ La reconnaissance n'a détecté aucune voix après 8 secondes. Causes possibles : connexion lente vers les serveurs Google, micro mal configuré, ou parlez plus fort. Vous pouvez taper votre dictée manuellement ci-dessous.");
          }
        }, 8000);
      };`
);
ok(s.includes("hasResults"), "timeout");

// 3. Marquer hasResults quand on reçoit du texte
s = s.replace(
  `        if (finalText.trim()) {
          console.log('[Dictée] Texte final:', finalText.trim().slice(0, 80));
          setTranscript(prev => (prev.trim() ? prev.trim() + ' ' : '') + finalText.trim());
        }
        setInterim(interimText);`,
  `        if (finalText.trim()) {
          console.log('[Dictée] FINAL:', finalText.trim().slice(0, 80));
          setTranscript(prev => (prev.trim() ? prev.trim() + ' ' : '') + finalText.trim());
          setHasResults(true);
          setRecogDebug(prev => [...prev.slice(-5), '✓ Reçu: ' + finalText.trim().slice(0, 30)]);
        }
        if (interimText.trim()) {
          setHasResults(true);
        }
        setInterim(interimText);`
);
ok(s.includes("hasResults = true"), "hasResults");

// 4. Améliorer l'affichage de l'interim — le rendre TRÈS visible
const oldInterim = `{isRecording && interim && (
                  <div className="absolute bottom-2 left-4 right-4 text-sm italic text-slate-400 pointer-events-none bg-white/80 rounded px-1">
                    {interim}…
                  </div>
                )}`;
const newInterim = `{isRecording && interim && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className="absolute bottom-3 left-4 right-4 text-lg font-medium text-blue-700 pointer-events-none bg-blue-50/90 backdrop-blur rounded-lg px-3 py-2 border border-blue-200 shadow-sm"
                  >
                    <span className="animate-pulse inline-block w-2 h-4 bg-blue-500 rounded-sm mr-2 align-middle" />
                    {interim}
                  </motion.div>
                )}
                {isRecording && !interim && !hasResults && (
                  <div className="absolute bottom-3 left-4 right-4 text-sm text-stone-400 pointer-events-none flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    À l'écoute… parlez distinctement
                  </div>
                )}`;
if (s.includes(oldInterim)) {
  s = s.replace(oldInterim, newInterim);
  ok(true, "interim");
} else {
  console.log("WARN: pattern interim non trouvé");
}

// 5. Ajouter le panneau de debug (repliable) sous le statut
const debugPanel = `{/* Panneau de debug reconnaissance */}
          {recogDebug.length > 0 && (
            <div className="mx-auto max-w-md mt-2 p-2 bg-stone-50 border border-stone-200 rounded-lg text-[11px] font-mono text-stone-500 space-y-0.5">
              {recogDebug.map((line, i) => <div key={i}>{line}</div>)}
            </div>
          )}`;
s = s.replace(
  `{/* Indicateurs de diagnostic navigateur + IA */}`,
  debugPanel + `\n\n          {/* Indicateurs de diagnostic navigateur + IA */}`
);
ok(s.includes("recogDebug"), "debug panel");

fs.writeFileSync("src/components/MedicalDictation.tsx", s);
console.log("MedicalDictation: timeout + interim visible + debug ✓");
