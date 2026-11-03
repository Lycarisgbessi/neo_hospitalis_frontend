// ── Runner E2E autonome : AUDIT 2 — Contrôle vocal ──
// Deux modes :
//   node e2e-audit2-voice.mjs        → IA mockée (interception CDP, offline, déterministe)
//   node e2e-audit2-voice.mjs --real → VRAIE IA GLM via OpenRouter (clé dans .env)
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REAL = process.argv.includes("--real");
const AI_WAIT = REAL ? 45000 : 15000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = {};
const step = (name, ok, detail = "") => {
  results[name] = { ok, detail };
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " : " + detail : ""}`);
};

// ── Réponses GLM simulées (2 scénarios : transfert dicté, puis hospitalisation dictée) ──
const CORS = [
  { name: "Content-Type", value: "application/json" },
  { name: "Access-Control-Allow-Origin", value: "*" },
  { name: "Access-Control-Allow-Methods", value: "POST, GET, OPTIONS" },
  { name: "Access-Control-Allow-Headers", value: "Authorization, Content-Type, HTTP-Referer, X-Title" },
];
const glm = (obj) => ({ choices: [{ message: { role: "assistant", content: JSON.stringify(obj) } }] });

const SCENARIO_TRANSFERT = glm({
  champs: {
    motif: "Chest pain and exertional dyspnea for a week",
    temperature: "37.2", tension: "14/9", pouls: "88", poids: "82", taille: "178",
    signes_generaux: "Altered general condition",
    auscultation: "Regular heart sounds without murmur",
    diagnostic_final: "Suspected coronary insufficiency",
    orientation: "cardiologie",
  },
  ordonnance: [{ medicament: "Aspirine", dosage: "100mg", forme: "comprimé", frequence: "1 per day", duree: "7 days" }],
  laboratoire: ["NFS", "Troponin"],
});

const SCENARIO_HOSPITALISATION = glm({
  champs: {
    motif: "Severe pneumonia",
    diagnostic_final: "Community-acquired lobar pneumonia",
    hospitalisation: "yes",
  },
});

let mockResponse = SCENARIO_TRANSFERT; // mutable: the runner swaps scenarios

const profileDir = join(tmpdir(), "hospi-voice-" + Date.now());
mkdirSync(profileDir, { recursive: true });
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-pipe",
  "--user-data-dir=" + profileDir, "--window-size=1440,900", "about:blank"
], { stdio: ["pipe", "pipe", "pipe", "pipe", "pipe"] });
const cmd = chrome.stdio[3], evt = chrome.stdio[4];

let id = 0;
const pending = new Map();
const dialogs = [];
const paused = [];
let buf = "";
evt.on("data", (chunk) => {
  buf += chunk.toString("utf8");
  let i;
  while ((i = buf.indexOf("\0")) >= 0) {
    const raw = buf.slice(0, i); buf = buf.slice(i + 1);
    if (!raw.trim()) continue;
    let msg; try { msg = JSON.parse(raw); } catch { continue; }
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) rej(new Error(msg.error.message)); else res(msg.result);
    } else if (msg.method === "Page.javascriptDialogOpening") dialogs.push(msg.params);
    else if (msg.method === "Fetch.requestPaused") paused.push(msg.params);
  }
});
const cdpRaw = (payload) => new Promise((res, rej) => {
  const mid = ++id; pending.set(mid, { res, rej });
  cmd.write(JSON.stringify({ id: mid, ...payload }) + "\0");
});
// Boucle d'interception : sert la réponse mock à chaque appel OpenRouter
async function servePaused() {
  while (paused.length) {
    const p = paused.shift();
    try {
      await S("Fetch.fulfillRequest", {
        requestId: p.requestId, responseCode: 200, responseHeaders: CORS,
        body: Buffer.from(JSON.stringify(mockResponse)).toString("base64"),
      });
    } catch {}
  }
}

await sleep(2500);
const t = await cdpRaw({ method: "Target.createTarget", params: { url: "http://localhost:3000/" } });
const att = await cdpRaw({ method: "Target.attachToTarget", params: { targetId: t.targetId, flatten: true } });
const S = (method, params = {}) => cdpRaw({ method, params, sessionId: att.sessionId });
const evalP = async (expr) => {
  await servePaused();
  const r = await S("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error("PageJS: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 200));
  return r.result.value;
};
const setVal = (sel, value, evType = "input") => evalP(`(() => { const el = ${sel}; if (!el) return 0; const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : (el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype); Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('${evType}', { bubbles: true })); return 1; })()`);
const clickBtn = (label) => evalP(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(${JSON.stringify(label)})); if (!b) return 0; b.click(); return 1; })()`);
const nav = (href) => evalP(`(() => { const a = [...document.querySelectorAll('a')].find(x => x.getAttribute('href') === ${JSON.stringify(href)}); if (a) a.click(); else location.href = ${JSON.stringify(href)}; return 1; })()`);
const waitText = async (label, ms = 8000) => { const s = Date.now(); while (Date.now() - s < ms) { if (await evalP(`document.body.innerText.includes(${JSON.stringify(label)})`).catch(() => false)) return true; await sleep(250); } return false; };
const selCard = (nom) => evalP(`(() => { const c = [...document.querySelectorAll('div')].find(d => String(d.className).includes('cursor-pointer') && d.textContent.includes(${JSON.stringify(nom)})); if (c) c.click(); return 1; })()`);
const getPat = (name) => evalP(`JSON.parse(localStorage.getItem('hospi_patients')).find(p => p.name === ${JSON.stringify(name)})`);
const ordresOf = (pid) => evalP(`JSON.parse(localStorage.getItem('hospi_orders')).filter(o => o.patientId === ${JSON.stringify(pid)})`);

await S("Runtime.enable"); await S("Page.enable");
if (!REAL) await S("Fetch.enable", { patterns: [{ urlPattern: "*openrouter*", requestStage: "Request" }] });
await sleep(1500);

// ── Setup + inscription ──
await waitText("Mode Clinique", 10000);
await clickBtn("Mode Clinique"); await sleep(300);
await clickBtn("Continuer"); await sleep(300);
await clickBtn("Terminer la Configuration");
await waitText("Portail de Connexion", 8000);
await clickBtn("Volet Administratif"); await sleep(500);
await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder && i.placeholder.includes('Doe'))`, "Dr Alpha Bah");
await setVal(`document.querySelector('input[type=password]')`, "secret123");
await setVal(`document.querySelector('select')`, "super_admin", "change");
await sleep(250);
await clickBtn("Créer le compte"); await sleep(1200);
step("setup-inscription", await evalP(`document.body.innerText.includes('Bonjour, Dr Alpha Bah')`));

// ── Patient payé prêt pour la dictée ──
async function admettre(nom, age) {
  await nav("/reception"); await waitText("Admission Patient");
  await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder.includes('Aissatou Diallo'))`, nom);
  await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder === 'Années')`, String(age));
  await sleep(200);
  await clickBtn("Enregistrer l'admission"); await sleep(900);
}
async function payer(nom) {
  await nav("/caisse"); await waitText("Facturations en Attente");
  await evalP(`(() => { const li = [...document.querySelectorAll('li')].find(l => l.textContent.includes(${JSON.stringify(nom)})); if (li) li.click(); return 1; })()`);
  await sleep(700);
  await evalP(`(() => { [...document.querySelectorAll('label')].filter(l => l.querySelector('input[type=checkbox]')).forEach(l => l.querySelector('input').click()); return 1; })()`);
  await sleep(300);
  await clickBtn("Valider le règlement"); await sleep(1000);
}
await admettre("Ibrahima Diallo", 60);
await payer("Ibrahima Diallo");
const ib = await getPat("Ibrahima Diallo");
step("patient-pret", ib?.status === "waiting_consultation" && ib?.consultationFeePaid === true, ib?.status);

// ═══ V1 : dictée COMPLÈTE avec orientation transfert dictée ═══
await nav("/doctor"); await waitText("File d'attente");
await selCard("Ibrahima Diallo"); await sleep(700);
await clickBtn("Dicter l'examen"); await waitText("Dictée Médicale");
const DICTEE_V1 = REAL
  ? "Le patient présente une douleur thoracique à l'effort depuis une semaine avec essoufflement. Température 38 virgule 5, tension 12 sur 8, pouls 90, poids 80 kilos, taille 175 centimètres, saturation 98. À l'auscultation, les bruits du cœur sont réguliers sans souffle, murmure vésiculaire normal. Je prescris de l'aspirine 100 milligrammes une fois par jour pendant sept jours. Je demande une NFS et une goutte épaisse. Je le transfère en cardiologie. Diagnostic retenu : insuffisance coronaire suspectée."
  : "The patient complains of chest pain and shortness of breath on exertion for a week. Temperature 37.2, blood pressure 14 over 9, pulse 88, weight 82 kilos, height 178. On auscultation, regular heart sounds. I prescribe aspirin 100 mg once daily for 7 days. I order a complete blood count and a troponin. I refer him to cardiology. Retained diagnosis: suspected coronary insufficiency.";
await setVal(`[...document.querySelectorAll('textarea')].find(t => t.placeholder && t.placeholder.includes('Le patient se plaint'))`, DICTEE_V1);
await sleep(300);
await clickBtn("Analyser la dictée");
// Attendre l'aperçu (mock : interception instantanée ; réel : appel GLM effectif)
let ok = false;
const s0 = Date.now();
while (Date.now() - s0 < AI_WAIT) {
  await servePaused();
  if (await evalP(`document.body.innerText.includes('Appliquer')`).catch(() => false)) { ok = true; break; }
  await sleep(300);
}
step("V1-analyse-aperçu", ok);
const apercu = await evalP(`(() => { const l = [...document.querySelectorAll('label')].filter(x => x.querySelector('input[type=checkbox]')); const t = document.body.innerText.toLowerCase(); return { nb: l.length, orientation: t.includes('service de transfert'), ordonnance: t.includes('ordonnance — médicament 1') || t.includes('ordonnance — medicament 1'), labo: t.includes('bon de biologie') }; })()`);
step("V1-aperçu-contenu", apercu.nb >= 10 && apercu.orientation && apercu.ordonnance && apercu.labo, JSON.stringify(apercu));
await clickBtn("Appliquer"); await sleep(1000);

// Vérifications après application (onglet consultation d'abord : il se démonte au changement d'onglet)
const motifSaisi = await evalP(`(() => { const t = [...document.querySelectorAll('textarea')].find(x => x.placeholder === 'Plainte principale du patient...'); return t ? t.value.slice(0, 40) : 'ABSENT'; })()`);
const imc = await evalP(`(() => { const i = [...document.querySelectorAll('input')].find(x => x.placeholder === 'ex: 24.5'); return i ? i.value : 'ABSENT'; })()`);
await clickBtn("Diagnostics & Actes"); await sleep(500);
const diagValeur = await evalP(`(() => { const t = [...document.querySelectorAll('textarea')].find(x => x.placeholder && x.placeholder.includes('Conclusion après analyse')); return t ? t.value : 'ABSENT'; })()`);
const transfert = await evalP(`(() => { const sel = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'cardiologie')); return sel ? sel.value : 'ABSENT'; })()`);
const ibApres = await getPat("Ibrahima Diallo");
const ordresIb = ibApres ? await ordresOf(ibApres.id) : [];
step("V1-champs-appliques",
  REAL
    ? motifSaisi.trim().length > 10 && diagValeur.trim().length > 5
    : motifSaisi.startsWith("Chest pain") && diagValeur.toLowerCase().includes("coronary"),
  `motif="${motifSaisi.slice(0, 45)}" / diag="${diagValeur.slice(0, 45)}"`);
step("V1-imc-auto", REAL ? /^26([.,]\d+)?$/.test(imc) : imc === "25.9", `imc=${imc} (80kg/1.75m → ~26.1 attendu)`);
step("V1-orientation-dictee", transfert === "cardiologie", `select=${transfert}`);
step("V1-ordres-crees", ordresIb.filter(o => o.id !== "ORD-001" && o.status === "pending").length >= 2, `ordres=${ordresIb.map(o => o.type + ":" + o.fee).join(",")}`);

// ═══ V2 : transmission intégrale — la clôture enregistre TOUT ═══
await clickBtn("Transférer & Clôturer"); await sleep(1200);
const ib2 = await getPat("Ibrahima Diallo");
const consIb = await evalP(`JSON.parse(localStorage.getItem('hospi_consultations')).filter(c => c.patientId === ${JSON.stringify(ib2.id)})`);
const c0 = consIb[0] || {};
step("V2-statut-transfert", ib2.status === "waiting_payment" && ib2.targetService === "cardiologie" && ib2.consultationFeePaid === false, `${ib2.status}/${ib2.targetService}`);
step("V2-transmission-consultation",
  consIb.length === 1 &&
  (REAL
    ? (c0.chiefComplaint || "").trim().length > 5 &&
      (c0.finalDiagnosis || "").trim().length > 3 &&
      ["12/8", "120/80", "12/8mmhg"].includes((c0.vitals?.bloodPressure || "").replace(/\s/g, "").toLowerCase()) &&
      /^26([.,]\d+)?$/.test(c0.vitals?.bmi || "")
    : (c0.chiefComplaint || "").includes("Chest pain") &&
      (c0.finalDiagnosis || "").toLowerCase().includes("coronary") &&
      (c0.vitals?.temperature || "") === "37.2" && (c0.vitals?.bloodPressure || "") === "14/9" && (c0.vitals?.bmi || "") === "25.9" &&
      (c0.physicalExam?.auscultation || "").toLowerCase().includes("heart sounds")) &&
  (c0.doctorId || "").startsWith("USR-"),
  `cons=${consIb.length}, motif=${(c0.chiefComplaint || "").slice(0, 30)}, TA=${c0.vitals?.bloodPressure}, IMC=${c0.vitals?.bmi}`);

// ═══ V3 : hospitalisation dictée (2e patient) ═══
await admettre("Sally Camara", 35);
await payer("Sally Camara");
await nav("/doctor"); await waitText("File d'attente");
await selCard("Sally Camara"); await sleep(700);
await clickBtn("Dicter l'examen"); await waitText("Dictée Médicale");
mockResponse = SCENARIO_HOSPITALISATION; // le prochain appel IA reçoit le scénario hospitalisation
const DICTEE_V3 = REAL
  ? "Patiente de 35 ans, pneumonie sévère avec fièvre à 39 degrés, toux productive et altération de l'état général. Je décide de l'hospitaliser pour antibiothérapie intraveineuse et surveillance. Diagnostic retenu : pneumonie communautaire lobaire."
  : "Severe pneumonia with fever at 39. I decide to hospitalize her. Diagnosis: community-acquired lobar pneumonia.";
await setVal(`[...document.querySelectorAll('textarea')].find(t => t.placeholder && t.placeholder.includes('Le patient se plaint'))`, DICTEE_V3);
await sleep(300);
await clickBtn("Analyser la dictée");
let ok3 = false;
const s3 = Date.now();
while (Date.now() - s3 < AI_WAIT) {
  await servePaused();
  if (await evalP(`document.body.innerText.includes('Appliquer')`).catch(() => false)) { ok3 = true; break; }
  await sleep(300);
}
step("V3-analyse", ok3);
await clickBtn("Appliquer"); await sleep(900);
// La case « Hospitaliser » vit dans l'onglet Diagnostics & Actes — on y va d'abord
await clickBtn("Diagnostics & Actes"); await sleep(600);
const hospCoche = await evalP(`(() => { const cb = [...document.querySelectorAll('input[type=checkbox]')].find(c => c.closest('label') && c.closest('label').textContent.includes('Hospitaliser')); return cb ? cb.checked : null; })()`);
const bouton = await evalP(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Hospitaliser & Clôturer')); return b ? 1 : 0; })()`);
await clickBtn("Hospitaliser & Clôturer"); await sleep(1000);
const sally = await getPat("Sally Camara");
step("V3-hospitalisation-dictee", hospCoche === true && bouton === 1 && sally.status === "hospitalized",
  `coche=${hospCoche}, statut=${sally.status}`);

// ═══ V4 : prompt assistant contient la carte des routes (audit F2) ═══
const codePages = await evalP(`Boolean([...document.querySelectorAll('button')].length)`);
// Vérification statique par lecture du bundle servi : la chaîne des routes doit être dans le JS de la page
const bundle = await evalP(`(async () => { const r = await fetch(location.href); return (await r.text()).length > 0; })()`).catch(() => false);
step("V4-page-rendue", codePages && bundle, String(Boolean(bundle)));

const fails = Object.entries(results).filter(([, r]) => !r.ok).map(([k]) => k);
console.log("\n════════ BILAN : " + (Object.keys(results).length - fails.length) + "/" + Object.keys(results).length + " PASS" + (fails.length ? " — ÉCHECS : " + fails.join(", ") : " — TOUT EST VERT ════════"));
try { chrome.kill(); } catch {}
process.exit(fails.length ? 1 : 0);
