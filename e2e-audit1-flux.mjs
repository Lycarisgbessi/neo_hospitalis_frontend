// ── Runner E2E autonome : AUDIT 1 (3e passe) — CIRCULATION DE L'INFORMATION ──
// Chaîne complète, sens direct ET retour :
// Réception(triage urgence) → Caisse → Gynéco(consult'+3 ordres+transfert)
// → Caisse → Labo → Imagerie → Pharmacie → Généraliste (voit TOUT : triage X2,
// spécialité X1, dossier complet, exécutions X4) → clôture.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = {};
const step = (name, ok, detail = "") => {
  results[name] = { ok, detail };
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " : " + detail : ""}`);
};

const profileDir = join(tmpdir(), "hospi-flux-" + Date.now());
mkdirSync(profileDir, { recursive: true });
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-pipe",
  "--user-data-dir=" + profileDir, "--window-size=1440,900", "about:blank"
], { stdio: ["pipe", "pipe", "pipe", "pipe", "pipe"] });
const cmd = chrome.stdio[3], evt = chrome.stdio[4];

let id = 0;
const pending = new Map();
const dialogs = [];
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
  }
});
const cdpRaw = (payload) => new Promise((res, rej) => {
  const mid = ++id; pending.set(mid, { res, rej });
  cmd.write(JSON.stringify({ id: mid, ...payload }) + "\0");
});

await sleep(2500);
const t = await cdpRaw({ method: "Target.createTarget", params: { url: "http://localhost:3000/" } });
const att = await cdpRaw({ method: "Target.attachToTarget", params: { targetId: t.targetId, flatten: true } });
const S = (method, params = {}) => cdpRaw({ method, params, sessionId: att.sessionId });
const evalP = async (expr) => {
  const r = await S("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error("PageJS: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 200));
  return r.result.value;
};
const setVal = (sel, value, evType = "input") => evalP(`(() => { const el = ${sel}; if (!el) return 0; const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : (el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype); Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('${evType}', { bubbles: true })); return 1; })()`);
const clickBtn = (label) => evalP(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(${JSON.stringify(label)})); if (!b) return 0; b.click(); return 1; })()`);
const clickAlert = async (label) => {
  void evalP(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(${JSON.stringify(label)})); if (b) b.click(); return 1; })()`).catch(() => null);
  await sleep(700);
  const s = Date.now();
  while (dialogs.length === 0 && Date.now() - s < 5000) await sleep(200);
  while (dialogs.length) { dialogs.shift(); try { await S("Page.handleJavaScriptDialog", { accept: true }); } catch {} }
};
const nav = (href) => evalP(`(() => { const a = [...document.querySelectorAll('a')].find(x => x.getAttribute('href') === ${JSON.stringify(href)}); if (a) a.click(); else location.href = ${JSON.stringify(href)}; return 1; })()`);
const waitText = async (label, ms = 8000) => { const s = Date.now(); while (Date.now() - s < ms) { if (await evalP(`document.body.innerText.includes(${JSON.stringify(label)})`).catch(() => false)) return true; await sleep(250); } return false; };
const selCard = (nom) => evalP(`(() => { const c = [...document.querySelectorAll('div')].find(d => String(d.className).includes('cursor-pointer') && d.textContent.includes(${JSON.stringify(nom)})); if (c) c.click(); return 1; })()`);
const getPat = (name) => evalP(`JSON.parse(localStorage.getItem('hospi_patients')).find(p => p.name === ${JSON.stringify(name)})`);
const recordsOf = (pid) => evalP(`(JSON.parse(localStorage.getItem('hospi_patients')).find(p => p.id === ${JSON.stringify(pid)}) || {}).medicalRecords || []`);
const ordresOf = (pid) => evalP(`JSON.parse(localStorage.getItem('hospi_orders')).filter(o => o.patientId === ${JSON.stringify(pid)})`);

await S("Runtime.enable"); await S("Page.enable");
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

// ═══ FL1 : Réception — admission gynéco AVEC triage urgence ═══
await nav("/reception"); await waitText("Admission Patient");
await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder.includes('Aissatou Diallo'))`, "Mariama Sylla");
await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder === 'Années')`, "27");
await setVal(`[...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'gynecologie'))`, "gynecologie", "change");
await sleep(400);
// Motif « Suivi de grossesse » + situation « Grossesse en cours »
await setVal(`[...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'Suivi de grossesse'))`, "Suivi de grossesse", "change");
await setVal(`[...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'Grossesse en cours'))`, "Grossesse en cours", "change");
await evalP(`(() => { const cb = [...document.querySelectorAll('input[type=checkbox]')].find(c => c.closest('label') && c.closest('label').textContent.includes('urgence obstétricale')); if (cb) cb.click(); return 1; })()`);
await sleep(300);
await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder === "Motif de l'urgence...")`, "Métrorragies 3e trimestre");
await sleep(200);
await clickBtn("Enregistrer l'admission"); await sleep(900);
const mariama = await getPat("Mariama Sylla");
step("FL1-admission-triage",
  mariama?.status === "waiting_payment" &&
  mariama?.gynecoTriage?.urgence === true &&
  mariama?.gynecoTriage?.motifPrincipal === "Suivi de grossesse",
  `${mariama?.status}, urgence=${mariama?.gynecoTriage?.urgence}`);

// ═══ FL2 : Caisse — consultation gynéco 40 000 FG ═══
await nav("/caisse"); await waitText("Facturations en Attente");
await evalP(`(() => { const li = [...document.querySelectorAll('li')].find(l => l.textContent.includes('Mariama')); if (li) li.click(); return 1; })()`);
await sleep(700);
const items2 = await evalP(`[...document.querySelectorAll('label')].filter(l => l.querySelector('input[type=checkbox]')).map(l => l.textContent.replace(/\\s+/g,' ').trim())`);
await evalP(`(() => { [...document.querySelectorAll('label')].filter(l => l.querySelector('input[type=checkbox]')).forEach(l => l.querySelector('input').click()); return 1; })()`);
await sleep(300);
await clickBtn("Valider le règlement"); await sleep(1000);
const m2 = await getPat("Mariama Sylla");
step("FL2-paiement-consultation", items2.length === 1 && items2[0].includes("40") && m2.status === "waiting_consultation",
  `${items2.join("|").slice(0, 50)} → ${m2.status}`);

// ═══ FL3 : Gynéco — triage visible, consult' spécialisée, 3 ordres, transfert ═══
await nav("/gyneco"); await waitText("File Gynécologie");
await selCard("Mariama Sylla"); await sleep(800);
const prefill = await evalP(`(() => { const i = [...document.querySelectorAll('input')].find(x => x.placeholder === 'Raison de la venue...'); return i ? i.value : 'ABSENT'; })()`);
step("FL3-prefill-triage", prefill === "Suivi de grossesse", `motif prérempli="${prefill}"`);
await clickBtn("Gynécologique"); await sleep(400); // consultType = gyneco (pour X1)

// 3 ordres : ordonnance + labo + imagerie
await clickBtn("Diagnostics & Actes"); await sleep(500);
await clickBtn("Ordonnance Méd."); await sleep(700);
await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder === 'Ex: Paracétamol')`, "Fer + Acide folique");
await sleep(200);
await clickBtn("Valider & Enregistrer"); await sleep(800);
await clickBtn("Bon Laboratoire"); await sleep(700);
await evalP(`(() => { const l = [...document.querySelectorAll('label')].find(x => x.textContent.trim() === 'NFS'); if (l) l.querySelector('input').click(); return 1; })()`);
await sleep(200);
await clickBtn("Valider & Enregistrer"); await sleep(800);
await clickBtn("Échographie / Imagerie"); await sleep(700);
await setVal(`[...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'Échographie'))`, "Échographie", "change");
await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder === 'Ex: Thorax, Abdomen, Genou droit...')`, "Pelvienne");
await sleep(200);
await clickBtn("Valider & Enregistrer"); await sleep(800);

// Diagnostic + transfert vers général
await setVal(`[...document.querySelectorAll('textarea')].find(t => t.placeholder && t.placeholder.includes('Conclusion après analyse'))`, "Grossesse évolutive — menace d'accouchement prématuré, transfert en médecine générale pour bilan");
await sleep(300);
await evalP(`(() => { const sel = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'general')); Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, 'general'); sel.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
await sleep(300);
await clickBtn("Transférer & Clôturer"); await sleep(1100);

const m3 = await getPat("Mariama Sylla");
const ordres3 = m3 ? await ordresOf(m3.id) : [];
step("FL3-transfert-general",
  m3.status === "waiting_payment" && m3.targetService === "general" && m3.consultationFeePaid === false,
  `${m3.status}/${m3.targetService}`);
step("FL3-trois-ordres",
  ordres3.length === 3 && ordres3.some(o => o.type === "pharmacy" && o.fee === 0) && ordres3.some(o => o.type === "lab" && o.fee === 100000) && ordres3.some(o => o.type === "imagerie" && o.fee === 250000),
  ordres3.map(o => o.type + ":" + o.fee).join(", "));

// ═══ FL4 : Caisse — consultation générale + 3 actes (365 000 FG) ═══
await nav("/caisse"); await waitText("Facturations en Attente");
await evalP(`(() => { const li = [...document.querySelectorAll('li')].find(l => l.textContent.includes('Mariama')); if (li) li.click(); return 1; })()`);
await sleep(700);
const items4 = await evalP(`[...document.querySelectorAll('label')].filter(l => l.querySelector('input[type=checkbox]')).map(l => l.textContent.replace(/\\s+/g,' ').trim())`);
await evalP(`(() => { [...document.querySelectorAll('label')].filter(l => l.querySelector('input[type=checkbox]')).forEach(l => l.querySelector('input').click()); return 1; })()`);
await sleep(300);
await clickBtn("Valider le règlement"); await sleep(1100);
const m4 = await getPat("Mariama Sylla");
step("FL4-refacturation-actes",
  items4.length === 4 && items4.some(i => i.includes("Consultation") && i.includes("15")) && items4.some(i => i.includes("offert")) && m4.status === "waiting_consultation",
  `${items4.length} items → ${m4.status}`);

// ═══ FL5 : Laboratoire exécute ═══
await nav("/labo"); await waitText("Analyses en Attente");
await clickBtn("Saisir les résultats"); await sleep(700);
await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder.includes('Hémoglobine'))`, "NFS");
await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder === 'Valeur')`, "Hb 10.8 — anémie légère");
await sleep(250);
await clickAlert("Signer & Transmettre"); await sleep(900);
const recs5 = m4 ? await recordsOf(m4.id) : [];
step("FL5-labo-record",
  recs5.some(r => r.type === "lab_result" && r.summary.includes("NFS") && !r.summary.includes("- NFS")),
  recs5.map(r => r.type).join(","));

// ═══ FL6 : Imagerie rédige le CR ═══
await nav("/imagerie"); await waitText("Examens en Attente");
await clickBtn("Rédiger le CR"); await sleep(700);
await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder === 'Ex: Échographie Abdomino-Pelvienne')`, "Échographie pelvienne");
await setVal(`[...document.querySelectorAll('textarea')].find(t => t.placeholder && t.placeholder.includes('Conclusion courte'))`, "Utérus gravide, placenta bas inséré");
await sleep(250);
await clickBtn("Signer le CR & Transmettre"); await sleep(900);
const recs6 = m4 ? await recordsOf(m4.id) : [];
step("FL6-imagerie-record", recs6.some(r => r.type === "imagerie_result" && r.summary.includes("pelvienne")), recs6.map(r => r.type).join(","));

// ═══ FL7 : Pharmacie délivre ═══
await nav("/pharmacie"); await waitText("Comptoir de Délivrance");
await clickBtn("Traiter l'ordonnance"); await sleep(700);
await clickAlert("Confirmer la délivrance"); await sleep(900);
const recs7 = m4 ? await recordsOf(m4.id) : [];
const ordres7 = m4 ? await ordresOf(m4.id) : [];
step("FL7-pharmacie-dispensation",
  recs7.some(r => r.type === "dispensation") && ordres7.find(o => o.type === "pharmacy")?.status === "completed",
  recs7.map(r => r.type).join(","));

// ═══ FL8 : Le GÉNÉRALISTE voit TOUT (retour services → médecin) ═══
await nav("/doctor"); await waitText("File d'attente");
await selCard("Mariama Sylla"); await sleep(800);
await clickBtn("Historique & Infos"); await sleep(600);
// NB : les titres de sections sont rendus en MAJUSCULES par CSS → comparaison insensible à la casse
const vue = await evalP(`(() => { const t = document.body.innerText.toLowerCase(); return {
  triage: t.includes("triage à l'admission") && t.includes('urgence') && t.includes('métrorragies'),
  specialite: t.includes('examen gynéco'),
  labo: t.includes('résultats laboratoire') && t.includes('nfs'),
  imagerie: t.includes("compte-rendu d'imagerie") && t.includes('pelvienne'),
  dispensation: t.includes('dispensation pharmacie') && t.includes('fer'),
  conclusion: t.includes('grossesse évolutive')
}; })()`);
step("FL8-X2-triage-visible-generaliste", vue.triage, JSON.stringify(vue.triage));
step("FL8-X1-specialite-cross-page", vue.specialite, JSON.stringify(vue.specialite));
step("FL8-dossier-complet", vue.labo && vue.imagerie && vue.dispensation && vue.conclusion,
  `labo=${vue.labo} ima=${vue.imagerie} disp=${vue.dispensation}`);

// ═══ FL9 : X4 — le médecin voit ses prescriptions EXÉCUTÉES ═══
await clickBtn("Diagnostics & Actes"); await sleep(600);
const executes = await evalP(`(document.body.innerText.match(/Exécuté ✓/g) || []).length`);
const payes = await evalP(`(document.body.innerText.match(/Payé(?! ✓)/g) || []).length`);
step("FL9-X4-execution-visible", executes >= 2, `badges Exécuté=${executes}`);

// ═══ FL10 : Clôture du généraliste → fin de parcours ═══
await setVal(`[...document.querySelectorAll('textarea')].find(t => t.placeholder && t.placeholder.includes('Conclusion après analyse'))`, "Bilan complété — poursuite surveillance obstétricale");
await sleep(250);
await clickBtn("Clôturer la Consultation"); await sleep(1000);
const m10 = await getPat("Mariama Sylla");
const recs10 = m10 ? await recordsOf(m10.id) : [];
const payTotal = await evalP(`JSON.parse(localStorage.getItem('hospi_payments')).reduce((a,p)=>a+p.totalPaid,0)`);
step("FL10-fin-parcours",
  m10.status === "treated" && recs10.length === 3 && payTotal === 405000,
  `${m10.status}, records=${recs10.length}, recettes=${payTotal} FG (40k + 365k attendu)`);

// ═══ FL11 (Y2) : âge extrême écrêté ═══
await nav("/reception"); await waitText("Admission Patient");
await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder.includes('Aissatou Diallo'))`, "Vieux Test");
await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder === 'Années')`, "999");
await sleep(200);
await clickBtn("Enregistrer l'admission"); await sleep(900);
const vieux = await getPat("Vieux Test");
// Garde-fou valide = blocage navigateur (patient non créé) OU écrêtage code (≤ 120)
step("FL11-Y2-age-cretes", vieux === undefined || vieux.age <= 120, vieux === undefined ? "soumission bloquée par max=120 (aucun dossier absurde)" : `âge=${vieux.age}`);

// ═══ FL12 (Y1) : montant négatif de bon de commande écrêté ═══
await nav("/labo"); await waitText("Laboratoire de Biologie");
await clickBtn("Cmd Réactifs (PO)"); await sleep(600);
await setVal(`[...document.querySelectorAll('textarea')].find(t => t.placeholder && t.placeholder.includes('Kits Glucose'))`, "Test réactifs");
await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder === 'Ex: 1500000')`, "-5000000");
await sleep(200);
await clickBtn("Soumettre"); await sleep(800);
const dernierPO = await evalP(`(JSON.parse(localStorage.getItem('hospi_purchaseOrders') || '[]')).slice(-1)[0]`);
step("FL12-Y1-montant-cretes", dernierPO?.amount === 0, `montant=${dernierPO?.amount} (-5 000 000 saisi)`);

// ═══ FL13 (Y3) : validation inline en gynéco (plus d'alert bloquant) ═══
await nav("/gyneco"); await waitText("File Gynécologie");
// Aminata Sow (mock) : gynéco, payée, non traitée → onglets actifs directement.
await selCard("Aminata Sow"); await sleep(700);
await clickBtn("Diagnostics & Actes"); await sleep(500);
await clickBtn("Enregistrer & Clôturer"); await sleep(800);
const erreurInline = await evalP(`(() => { const t = document.body.innerText; return t.includes('diagnostic retenu avant de clôturer'); })()`);
const statutAminata = (await getPat("Aminata Sow"))?.status;
step("FL13-Y3-validation-inline", erreurInline && statutAminata === "consultation" && dialogs.length === 0,
  `inline=${erreurInline}, statut=${statutAminata}, alerts=${dialogs.length}`);

const fails = Object.entries(results).filter(([, r]) => !r.ok).map(([k]) => k);
console.log("\n════════ BILAN : " + (Object.keys(results).length - fails.length) + "/" + Object.keys(results).length + " PASS" + (fails.length ? " — ÉCHECS : " + fails.join(", ") : " — CIRCULATION VÉRIFIÉE DE BOUT EN BOUT ════════"));
try { chrome.kill(); } catch {}
process.exit(fails.length ? 1 : 0);
