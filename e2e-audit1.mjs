// ── Runner E2E autonome : Audit 1 (T3c, T1, T2, T4) — CDP sur pipe, zéro dépendance ──
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

const profileDir = join(tmpdir(), "hospi-runner-" + Date.now());
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
    } else if (msg.method === "Page.javascriptDialogOpening") {
      dialogs.push(msg.params);
    }
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
await S("Runtime.enable"); await S("Page.enable");

const evalP = async (expr) => {
  const r = await S("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error("PageJS: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 200));
  return r.result.value;
};
const setVal = (sel, value, evType = "input") => evalP(`(() => { const el = ${sel}; if (!el) return 0; const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : (el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype); Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('${evType}', { bubbles: true })); return 1; })()`);
const clickBtn = (label) => evalP(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(${JSON.stringify(label)})); if (!b) return 0; b.click(); return 1; })()`);
// Clic déclenchant alert() : ne pas attendre l'évaluation (bloquée par la modale)
const clickAlert = async (label) => {
  void evalP(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(${JSON.stringify(label)})); if (b) b.click(); return 1; })()`).catch(() => null);
  await sleep(700);
  const s = Date.now();
  while (dialogs.length === 0 && Date.now() - s < 5000) await sleep(200);
  while (dialogs.length) { dialogs.shift(); try { await S("Page.handleJavaScriptDialog", { accept: true }); } catch {} }
};
const nav = (href) => evalP(`(() => { const a = [...document.querySelectorAll('a')].find(x => x.getAttribute('href') === ${JSON.stringify(href)}); if (a) a.click(); else location.href = ${JSON.stringify(href)}; return 1; })()`);
const waitText = async (label, ms = 8000) => { const s = Date.now(); while (Date.now() - s < ms) { if (await evalP(`document.body.innerText.includes(${JSON.stringify(label)})`).catch(() => false)) return true; await sleep(250); } return false; };
const getPat = (name) => evalP(`JSON.parse(localStorage.getItem('hospi_patients')).find(p => p.name === ${JSON.stringify(name)})`);
const ordresOf = (pid) => evalP(`JSON.parse(localStorage.getItem('hospi_orders')).filter(o => o.patientId === ${JSON.stringify(pid)})`);

await sleep(1500);

// ── Helpers parcours refondu (wizard + auth) ──
async function wizardSetup(adminName, adminPwd = "secret123", hospitalName = "Clinique Test") {
  await waitText("Configurer mon", 10000);
  await clickBtn("Configurer mon"); await sleep(1200);
  await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder && i.placeholder.includes('Clinique'))`, hospitalName);
  await clickBtn("Continuer"); await sleep(1200);
  await clickBtn("Continuer"); await sleep(1200);
  await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder && i.placeholder.includes('Dr Awa'))`, adminName);
  await setVal(`document.querySelector('input[type=password]')`, adminPwd);
  await clickBtn("Continuer"); await sleep(1200);
  await clickBtn("Lancer Hospitalis"); await sleep(3000);
}
async function createAccountByRole(roleLabel, name, pwd = "secret123", service = null) {
  await clickBtn("Déconnexion"); await waitText("Créer un compte", 8000); await sleep(500);
  await clickBtn("Créer un compte"); await sleep(1200);
  await evalP(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(${JSON.stringify(roleLabel)}) && x.className.includes('rounded-2xl')); if (b) b.click(); return 1; })()`);
  await sleep(500);
  if (service) {
    await evalP(`(() => { const s = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === ${JSON.stringify(service)})); if (s) { Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(service)}); s.dispatchEvent(new Event('change', { bubbles: true })); } return 1; })()`);
    await sleep(300);
  }
  await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder === 'Dr Jane Doe')`, name);
  await setVal(`document.querySelector('input[type=password]')`, pwd);
  await clickBtn("Créer mon compte"); await sleep(1500);
}
async function loginAs(name, pwd = "secret123") {
  await clickBtn("Déconnexion"); await waitText("Connexion", 8000); await sleep(500);
  await clickBtn("Connexion"); await sleep(400);
  await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder === 'Dr Jane Doe')`, name);
  await setVal(`document.querySelector('input[type=password]')`, pwd);
  await clickBtn("Se connecter"); await sleep(1500);
}

// ── Setup + inscription ──
await wizardSetup("Dr Alpha Bah");
step("setup-inscription", await evalP(`location.pathname === "/"`), "wizard + auto-login");

// Admettre un patient test en un appel (formulaire réception)
async function admettre(nom, age, modeExam = false, exams = []) {
  await nav("/reception"); await waitText("Admission Patient");
  if (modeExam) { await clickBtn("Examen direct"); await sleep(400); }
  await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder.includes('Aissatou Diallo'))`, nom);
  await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder === 'Années')`, String(age));
  if (modeExam && exams.length) {
    await evalP(`(() => { const ls = [...document.querySelectorAll('label')]; ${JSON.stringify(exams)}.forEach(x => { const l = ls.find(v => v.textContent.includes(x)); if (l) l.querySelector('input').click(); }); return 1; })()`);
  }
  await sleep(250);
  await clickBtn("Enregistrer l'admission"); await sleep(900);
}
async function payer(nom, { tout = true } = {}) {
  await nav("/caisse"); await waitText("Facturations en Attente");
  await evalP(`(() => { const li = [...document.querySelectorAll('li')].find(l => l.textContent.includes(${JSON.stringify(nom)})); if (li) li.click(); return 1; })()`);
  await sleep(700);
  const items = await evalP(`[...document.querySelectorAll('label')].filter(l => l.querySelector('input[type=checkbox]')).map(l => l.textContent.replace(/\\s+/g,' ').trim())`);
  await evalP(`(() => { [...document.querySelectorAll('label')].filter(l => l.querySelector('input[type=checkbox]')).forEach(l => l.querySelector('input').click()); return 1; })()`);
  await sleep(300);
  await clickBtn("Valider le règlement"); await sleep(1000);
  return items;
}

// ═══ T3 : accès direct (enregistrement → caisse → labo → clôture auto) ═══
await admettre("Mamadou Keïta", 52, true, ["Goutte épaisse", "NFS"]);
const t3pat = await getPat("Mamadou Keïta");
const t3ordres = t3pat ? await ordresOf(t3pat.id) : [];
step("T3-enregistrement",
  t3pat?.admissionType === "exam_direct" && t3pat.status === "waiting_payment" && t3ordres.length === 1 && t3ordres[0].fee === 100000,
  `${t3pat?.admissionType}/${t3pat?.status}/ordres=${t3ordres.map(o => o.type + ":" + o.fee).join(",")}`);

const t3items = await payer("Mamadou Keïta");
step("T3-caisse-sans-consultation",
  t3items.length === 1 && !t3items.some(i => i.includes("Consultation")),
  `items=${t3items.length}`);
const t3apres = await getPat("Mamadou Keïta");
step("T3-apres-paiement", t3apres.status === "waiting_consultation", t3apres.status);

await nav("/labo"); await waitText("Analyses en Attente");
await clickBtn("Saisir les résultats"); await sleep(700);
await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder.includes('Hémoglobine'))`, "Goutte épaisse");
await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder === 'Valeur')`, "Positive");
await sleep(250);
await clickAlert("Signer & Transmettre"); await sleep(800);
const t3fin = await getPat("Mamadou Keïta");
step("T3-cloture-auto", t3fin.status === "treated" && (t3fin.medicalRecords?.length || 0) === 1,
  `statut=${t3fin.status}, records=${t3fin.medicalRecords?.length || 0}`);

// ═══ T1 : transfert refacturé (plus de consultation gratuite) ═══
await admettre("Fatou Camara", 30);
const t1items = await payer("Fatou Camara");
await sleep(800); // laisser persister l'écriture localStorage (useEffect)
const t1a = await getPat("Fatou Camara");
step("T1-avant-transfert", t1a.status === "waiting_consultation" && t1items.some(i => i.includes("Consultation")), t1a.status);

await nav("/doctor"); await waitText("File d'attente");
await evalP(`(() => { const c = [...document.querySelectorAll('div')].find(d => String(d.className).includes('cursor-pointer') && d.textContent.includes('Fatou Camara')); if (c) c.click(); return 1; })()`);
await sleep(800);
await clickBtn("Diagnostics & Actes"); await sleep(500);
await setVal(`[...document.querySelectorAll('textarea')].find(t => t.placeholder && t.placeholder.includes('Conclusion après analyse'))`, "HTA suspectée — transfert cardiologie");
await sleep(300);
await evalP(`(() => { const sel = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'cardiologie')); Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, 'cardiologie'); sel.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
await sleep(300);
await clickBtn("Transférer & Clôturer"); await sleep(1000);
const t1b = await getPat("Fatou Camara");
step("T1-transfert-statut", t1b.status === "waiting_payment" && t1b.consultationFeePaid === false && t1b.targetService === "cardiologie",
  `${t1b.status}/${t1b.consultationFeePaid}/${t1b.targetService}`);
// Le patient non payé ne doit PAS être dans la file du médecin
const visibleQueue = await evalP(`[...document.querySelectorAll('div')].some(d => String(d.className).includes('cursor-pointer') && d.textContent.includes('Fatou Camara'))`);
step("T1-file-medecin-exclut-non-paye", visibleQueue === false, `visible=${visibleQueue}`);
// La caisse doit présenter la consultation cardiologie à 50 000 FG
await nav("/caisse"); await waitText("Facturations en Attente");
await evalP(`(() => { const li = [...document.querySelectorAll('li')].find(l => l.textContent.includes('Fatou')); if (li) li.click(); return 1; })()`);
await sleep(700);
const t1ligne = await evalP(`[...document.querySelectorAll('label')].filter(l => l.querySelector('input[type=checkbox]')).map(l => l.textContent.replace(/\\s+/g,' ').trim())`);
step("T1-refacturation-cardiologie",
  t1ligne.some(i => i.includes("Frais de Consultation")) && t1ligne.some(i => i.includes("50")),
  t1ligne.join(" | ").slice(0, 90));

// ═══ T2 : ordre à 0 FG visible et payable à la caisse ═══
await nav("/doctor"); await waitText("File d'attente");
await evalP(`(() => { const c = [...document.querySelectorAll('div')].find(d => String(d.className).includes('cursor-pointer') && d.textContent.includes('Jean Dupont')); if (c) c.click(); return 1; })()`);
await sleep(800);
await clickBtn("Diagnostics & Actes"); await sleep(500);
await clickBtn("Ordonnance"); await sleep(700);
await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder === 'Ex: Paracétamol')`, "Amoxicilline");
await sleep(250);
await clickBtn("Valider & Enregistrer"); await sleep(800);
const jean = await getPat("Jean Dupont");
const t2ordres = jean ? await ordresOf(jean.id) : [];
// Le nouvel ordre dicté : Amoxicilline seul, sans le tarif saisi → 0 FG (catalogue pharmacie).
// (ORD-001 est l'ordonnance de démonstration préexistante à 12 000 FG — on l'exclut.)
const pharm = t2ordres.find(o => o.type === "pharmacy" && o.id !== "ORD-001");
step("T2-ordre-0fg-cree", Boolean(pharm) && pharm.fee === 0 && pharm.status === "pending", pharm ? `fee=${pharm.fee}, ${pharm.details.slice(0, 40)}` : "ABSENT");
await nav("/caisse"); await waitText("Facturations en Attente");
await evalP(`(() => { const li = [...document.querySelectorAll('li')].find(l => l.textContent.includes('Jean Dupont')); if (li) li.click(); return 1; })()`);
await sleep(700);
const t2items = await evalP(`[...document.querySelectorAll('label')].filter(l => l.querySelector('input[type=checkbox]')).map(l => l.textContent.replace(/\\s+/g,' ').trim())`);
step("T2-visible-en-caisse", t2items.some(i => i.includes("pharmacy")), t2items.join(" | ").slice(0, 80));

// ═══ T4 : hospitalisation fonctionnelle ═══
await admettre("Boubacar Sow", 40);
await payer("Boubacar Sow");
await nav("/doctor"); await waitText("File d'attente");
await evalP(`(() => { const c = [...document.querySelectorAll('div')].find(d => String(d.className).includes('cursor-pointer') && d.textContent.includes('Boubacar Sow')); if (c) c.click(); return 1; })()`);
await sleep(800);
await clickBtn("Diagnostics & Actes"); await sleep(500);
await setVal(`[...document.querySelectorAll('textarea')].find(t => t.placeholder && t.placeholder.includes('Conclusion après analyse'))`, "Pneumonie sévère — hospitalisation");
await sleep(300);
await evalP(`(() => { const cb = [...document.querySelectorAll('input[type=checkbox]')].find(c => c.closest('label') && c.closest('label').textContent.includes('Hospitaliser')); if (cb) cb.click(); return 1; })()`);
await sleep(400);
const btnLabel = await evalP(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Hospitaliser & Clôturer')); return b ? b.textContent.trim() : 'ABSENT'; })()`);
await clickBtn("Hospitaliser & Clôturer"); await sleep(1000);
const t4pat = await getPat("Boubacar Sow");
step("T4-hospitalisation", t4pat.status === "hospitalized", `${t4pat.status} (bouton=${btnLabel})`);
const badge = await evalP(`document.body.innerText.includes('Hospitalisé')`);
step("T4-badge-file", badge, String(badge));
await nav("/");
await sleep(900);
const dash = await evalP(`document.body.innerText.replace(/[\\s\\u202F\\u00A0]+/g, ' ').includes('1 hospitalisé')`);
step("T4-dashboard", dash, String(dash));

// ═══ T5 (R1) : aucune donnée clinique ne fuite entre patients ═══
await nav("/doctor"); await waitText("File d'attente");
const selCard = (nom) => evalP(`(() => { const c = [...document.querySelectorAll('div')].find(d => String(d.className).includes('cursor-pointer') && d.textContent.includes(${JSON.stringify(nom)})); if (c) c.click(); return 1; })()`);
// Patient A : Jean — saisit un diagnostic + un transfert, SANS clôturer
await selCard("Jean Dupont"); await sleep(700);
await clickBtn("Diagnostics & Actes"); await sleep(500);
await setVal(`[...document.querySelectorAll('textarea')].find(t => t.placeholder && t.placeholder.includes('Conclusion après analyse'))`, "DIAGNOSTIC-PATIENT-A");
await evalP(`(() => { const sel = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'cardiologie')); if (sel) { Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, 'cardiologie'); sel.dispatchEvent(new Event('change', { bubbles: true })); } return 1; })()`);
await sleep(400);
// Patient B : Aminata — le formulaire doit être VIDE
await selCard("Aminata Sow"); await sleep(700);
await clickBtn("Diagnostics & Actes"); await sleep(500);
const diagB = await evalP(`(() => { const t = [...document.querySelectorAll('textarea')].find(x => x.placeholder && x.placeholder.includes('Conclusion après analyse')); return t ? t.value : 'ABSENT'; })()`);
const transfB = await evalP(`(() => { const sel = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'cardiologie')); return sel ? sel.value : 'ABSENT'; })()`);
const hospB = await evalP(`(() => { const cb = [...document.querySelectorAll('input[type=checkbox]')].find(c => c.closest('label') && c.closest('label').textContent.includes('Hospitaliser')); return cb ? cb.checked : null; })()`);
step("T5-non-contamination", diagB === "" && transfB === "" && hospB === false, `diag="${diagB.slice(0, 20)}", transfert="${transfB}", hosp=${hospB}`);

// ═══ T6 (R2) : dossiers clôturés en fin de file ═══
await selCard("Jean Dupont"); await sleep(700);
await clickBtn("Diagnostics & Actes"); await sleep(500);
await setVal(`[...document.querySelectorAll('textarea')].find(t => t.placeholder && t.placeholder.includes('Conclusion après analyse'))`, "Episode résolu");
await sleep(250);
await clickBtn("Clôturer la Consultation"); await sleep(1000);
const premiereCarte = await evalP(`(() => { const c = [...document.querySelectorAll('div')].filter(d => String(d.className).includes('cursor-pointer')); return c.length ? c[0].textContent.replace(/\\s+/g, ' ').slice(0, 80) : 'VIDE'; })()`);
const jeanPremier = premiereCarte.includes("Jean Dupont");
const traitePremier = premiereCarte.includes("Traité");
step("T6-tri-file", !jeanPremier && !traitePremier, `1re carte : ${premiereCarte.slice(0, 50)}`);

// Bilan
const fails = Object.entries(results).filter(([, r]) => !r.ok).map(([k]) => k);
console.log("\n════════ BILAN : " + (Object.keys(results).length - fails.length) + "/" + Object.keys(results).length + " PASS" + (fails.length ? " — ÉCHECS : " + fails.join(", ") : " — TOUT EST VERT ════════"));
try { chrome.kill(); } catch {}
process.exit(fails.length ? 1 : 0);
