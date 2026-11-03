// ── Runner E2E : AUDIT 1 (5e passe) — MULTI-RÔLES & POLYCLINIQUE ──
// Parcours distribué : réceptionniste → caissier → Dr gynéco → Dr cardiologue
// (cloisonnement W1) → technicien labo → comptable (nav W2).
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

const profileDir = join(tmpdir(), "hospi-poly-" + Date.now());
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
  while (dialogs.length === 0 && Date.now() - s < 4000) await sleep(200);
  while (dialogs.length) { dialogs.shift(); try { await S("Page.handleJavaScriptDialog", { accept: true }); } catch {} }
};
const nav = (href) => evalP(`(() => { const a = [...document.querySelectorAll('a')].find(x => x.getAttribute('href') === ${JSON.stringify(href)}); if (a) a.click(); else location.href = ${JSON.stringify(href)}; return 1; })()`);
const waitText = async (label, ms = 8000) => { const s = Date.now(); while (Date.now() - s < ms) { if (await evalP(`document.body.innerText.includes(${JSON.stringify(label)})`).catch(() => false)) return true; await sleep(250); } return false; };
const getPat = (name) => evalP(`JSON.parse(localStorage.getItem('hospi_patients')).find(p => p.name === ${JSON.stringify(name)})`);
const selCard = (nom) => evalP(`(() => { const c = [...document.querySelectorAll('div')].find(d => String(d.className).includes('cursor-pointer') && d.textContent.includes(${JSON.stringify(nom)})); if (c) { c.click(); return 1; } return 0; })()`);
const cardVisible = (nom) => evalP(`[...document.querySelectorAll('div')].some(d => String(d.className).includes('cursor-pointer') && d.textContent.includes(${JSON.stringify(nom)}))`);
const logout = async () => { await clickBtn("Déconnexion"); await waitText("Portail de Connexion", 6000); await sleep(400); };

// Créer un compte (volet, rôle, service si médical) puis connexion automatique
async function createAccount(voletBtn, role, service, name) {
  await waitText("Portail de Connexion", 8000);
  await clickBtn(voletBtn); await sleep(500);
  await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder && i.placeholder.includes('Doe'))`, name);
  await setVal(`document.querySelector('input[type=password]')`, "secret123");
  // rôle : 1er select du formulaire ; service : 2e select (mode polyclinique médical)
  await evalP(`(() => { const sel = document.querySelector('select'); Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, ${JSON.stringify(role)}); sel.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  if (service) {
    await sleep(300);
    await evalP(`(() => { const sels = [...document.querySelectorAll('select')]; const sel = sels.find(s => [...s.options].some(o => o.value === ${JSON.stringify(service)})); if (!sel) return 0; Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, ${JSON.stringify(service)}); sel.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  }
  await sleep(300);
  // Nouveau compte → « Créer le compte » ; utilisateur existant → « Se connecter »
  const cree = await clickBtn("Créer le compte");
  if (!cree) await clickBtn("Se connecter");
  await sleep(1200);
}

await S("Runtime.enable"); await S("Page.enable");
await sleep(1200);

// ═══ P1 : Setup en mode POLYCLINIQUE ═══
// ── Helpers parcours refondu (wizard + auth) ──
async function wizardSetup(adminName, adminPwd = "secret123", hospitalName = "Clinique Test", isPoly = false) {
  await waitText("Configurer mon", 10000);
  await clickBtn("Configurer mon"); await sleep(1200);
  if (isPoly) {
    await clickBtn("Polyclinique"); await sleep(400);
  }
  await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder && i.placeholder.includes('Clinique'))`, hospitalName);
  await clickBtn("Continuer"); await sleep(1200);
  await clickBtn("Continuer"); await sleep(1200);
  await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder && i.placeholder.includes('Dr Awa'))`, adminName);
  await setVal(`document.querySelector('input[type=password]')`, adminPwd);
  await clickBtn("Continuer"); await sleep(1200);
  await clickBtn("Lancer Hospitalis"); await sleep(3000);
}
async function createAccountByRole(roleLabel, name, pwd = "secret123", service = null) {
  await clickBtn("Déconnexion"); await waitText("Créer un compte", 8000); await sleep(1200);
  await clickBtn("Créer un compte"); await sleep(800);
  await evalP(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(${JSON.stringify(roleLabel)}) && x.className.includes('rounded-2xl')); if (b) b.click(); return 1; })()`);
  await sleep(1000); // laisser l'animation AnimatePresence terminer (select service)
  if (service) {
    await evalP(`(() => { const s = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === ${JSON.stringify(service)})); if (s) { Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(service)}); s.dispatchEvent(new Event('change', { bubbles: true })); } return 1; })()`);
    await sleep(500);
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

await wizardSetup("Dr Admin", "secret123", "Polyclinique Test", true);
step("P1-setup-polyclinique", await evalP(`location.pathname === "/"`), "wizard + auto-login");

// ═══ P2 : comptes par rôle ═══
await createAccountByRole("Réceptionniste", "Aïcha Réception");
const users1 = await evalP(`JSON.parse(localStorage.getItem('hospi_users')).length`);
step("P2a-compte-receptionniste", users1 >= 2 && (await evalP(`document.body.innerText.includes('Aïcha')`)), `users=${users1} (admin + Aïcha attendus)`);

// Nav réceptionniste : Réception + Dashboard UNIQUEMENT
const navRecep = await evalP(`[...document.querySelectorAll('aside nav a')].map(a => a.getAttribute('href'))`);
step("P2b-nav-receptionniste", JSON.stringify(navRecep) === JSON.stringify(["/reception", "/"]), navRecep.join(","));

// ═══ P3 : RBAC — réceptionniste bloqué sur /doctor ═══
await evalP(`location.href = '/doctor'`); await sleep(1200);
const rbacRedirect = await evalP(`location.pathname`);
step("P3-rbac-blocage-doctor", rbacRedirect === "/", `redirigé vers ${rbacRedirect}`);

// ═══ P4 : admission par la réceptionniste (gynéco + triage urgence) ═══
await nav("/reception"); await waitText("Admission Patient");
await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder.includes('Aissatou Diallo'))`, "Kadiatou Bah");
await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder === 'Années')`, "26");
await setVal(`[...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'gynecologie'))`, "gynecologie", "change");
await sleep(400);
await setVal(`[...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'Grossesse en cours'))`, "Grossesse en cours", "change");
await evalP(`(() => { const cb = [...document.querySelectorAll('input[type=checkbox]')].find(c => c.closest('label') && c.closest('label').textContent.includes('urgence obstétricale')); if (cb) cb.click(); return 1; })()`);
await sleep(300);
await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder === "Motif de l'urgence...")`, "Pré-éclampsie suspectée");
await sleep(200);
await clickBtn("Enregistrer l'admission"); await sleep(900);
const kad = await getPat("Kadiatou Bah");
step("P4-admission-gyneco", kad?.status === "waiting_payment" && kad?.gynecoTriage?.urgence === true, kad?.status);
await logout();

// ═══ P5 : caissier encaisse la consultation gynéco ═══
await createAccountByRole("Caissier", "Moussa Caisse");
const navCaissier = await evalP(`[...document.querySelectorAll('aside nav a')].map(a => a.getAttribute('href'))`);
step("P5a-nav-caissier", JSON.stringify(navCaissier) === JSON.stringify(["/caisse", "/"]), navCaissier.join(","));
await nav("/caisse"); await waitText("Facturations en Attente");
await evalP(`(() => { const li = [...document.querySelectorAll('li')].find(l => l.textContent.includes('Kadiatou')); if (li) li.click(); return 1; })()`);
await sleep(700);
await evalP(`(() => { [...document.querySelectorAll('label')].filter(l => l.querySelector('input[type=checkbox]')).forEach(l => l.querySelector('input').click()); return 1; })()`);
await sleep(300);
await clickBtn("Valider le règlement"); await sleep(1100);
const kad2 = await getPat("Kadiatou Bah");
step("P5b-encaissement-40k", kad2?.status === "waiting_consultation" && kad2?.consultationFeePaid === true, kad2?.status);
await logout();

// ═══ P6 : Dr Kaba (médecine, service GYNÉCOLOGIE) ═══
await createAccountByRole("Médecin", "Dr Kaba", "secret123", "gynecologie");
const navKaba = await evalP(`[...document.querySelectorAll('aside nav a')].map(a => a.getAttribute('href'))`);
step("P6a-nav-medecin-gyneco", navKaba.includes("/gyneco") && navKaba.includes("/doctor"), navKaba.join(","));
// File gynéco : Kadiatou visible, urgence en tête
await nav("/gyneco"); await waitText("File Gynécologie"); await sleep(700);
const kadVisible = await cardVisible("Kadiatou Bah");
const premiere = await evalP(`(() => { const c = [...document.querySelectorAll('div')].filter(d => String(d.className).includes('cursor-pointer')); return c.length ? c[0].textContent.replace(/\\s+/g, ' ').slice(0, 40) : 'VIDE'; })()`);
step("P6b-file-gyneco-urgence-en-tete", kadVisible && premiere.includes("Kadiatou"), `1re carte : ${premiere}`);
// DoctorPage de Kaba : service gynéco → il ne voit QUE gynéco (pas le mock général Jean Dupont)
await nav("/doctor"); await waitText("File d'attente"); await sleep(700);
const jeanVisiblePourKaba = await cardVisible("Jean Dupont");
step("P6c-cloisonnement-doctorpage", jeanVisiblePourKaba === false && (await cardVisible("Kadiatou Bah")), `Jean visible=${jeanVisiblePourKaba}`);

// Consultation de Kadiatou par Kaba : diagnostic + bon labo + clôture (libellés DoctorPage)
await selCard("Kadiatou Bah"); await sleep(800);
await clickBtn("Diagnostics & Actes"); await sleep(500);
await setVal(`[...document.querySelectorAll('textarea')].find(t => t.placeholder && t.placeholder.includes('Conclusion après analyse'))`, "Pré-éclampsie légère — bilan rénal demandé");
await clickBtn("Bon Biologie"); await sleep(700);
await evalP(`(() => { const l = [...document.querySelectorAll('label')].find(x => x.textContent.trim() === 'Créatininémie'); if (l) l.querySelector('input').click(); return 1; })()`);
await sleep(200);
await clickBtn("Valider & Enregistrer"); await sleep(800);
await clickBtn("Clôturer la Consultation"); await sleep(1100);
const kad3 = await getPat("Kadiatou Bah");
const ordresKad = kad3 ? await evalP(`JSON.parse(localStorage.getItem('hospi_orders')).filter(o => o.patientId === ${JSON.stringify(kad3.id)})`) : [];
step("P6d-consultation-clôturée", kad3?.status === "treated" && ordresKad.some(o => o.type === "lab" && o.fee === 100000), `${kad3?.status}, ordres=${ordresKad.length}`);
await logout();

// ═══ P7 : Dr Diallo (service CARDIOLOGIE) — cloisonnement W1 ═══
await createAccountByRole("Médecin", "Dr Diallo", "secret123", "cardiologie");
await nav("/gyneco"); await waitText("File Gynécologie"); await sleep(700);
const blocage = await evalP(`(() => { const t = document.body.innerText; return { bandeau: t.includes('réservée au service Gynécologie'), carte: t.includes('Kadiatou') }; })()`);
step("P7-W1-cloisonnement-gyneco", blocage.bandeau && !blocage.carte, `bandeau=${blocage.bandeau}, Kadiatou visible=${blocage.carte}`);
await nav("/doctor"); await waitText("File d'attente"); await sleep(700);
const dialloVoitKad = await cardVisible("Kadiatou Bah");
step("P7b-doctorpage-vide-cardiologie", dialloVoitKad === false, `patients cardiologie visibles (Kadiatou)=${dialloVoitKad}`);
await logout();

// ═══ P8 : technicien labo exécute (après paiement par le caissier) ═══
// (le patient est treated mais son bon labo est pending → caisse)
await loginAs("Moussa Caisse"); // re-connexion du compte existant
await nav("/caisse"); await waitText("Facturations en Attente");
await evalP(`(() => { const li = [...document.querySelectorAll('li')].find(l => l.textContent.includes('Kadiatou')); if (li) li.click(); return 1; })()`);
await sleep(700);
await evalP(`(() => { [...document.querySelectorAll('label')].filter(l => l.querySelector('input[type=checkbox]')).forEach(l => l.querySelector('input').click()); return 1; })()`);
await sleep(300);
await clickBtn("Valider le règlement"); await sleep(1000);
await logout();
await createAccountByRole("Technicien Laboratoire", "Séo Labo");
await nav("/labo"); await waitText("Analyses en Attente");
await clickBtn("Saisir les résultats"); await sleep(700);
await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder.includes('Hémoglobine'))`, "Créatininémie");
await setVal(`[...document.querySelectorAll('input')].find(i => i.placeholder === 'Valeur')`, "Normal");
await sleep(250);
await clickAlert("Signer & Transmettre"); await sleep(900);
const kadFin = await getPat("Kadiatou Bah");
step("P8-labo-execute", (kadFin?.medicalRecords?.length || 0) === 1, `records=${kadFin?.medicalRecords?.length}`);
await logout();

// ═══ P9 : comptable — nav W2 (supervision caisse) ═══
await createAccountByRole("Comptable", "Fatou Compta");
const navCompta = await evalP(`[...document.querySelectorAll('aside nav a')].map(a => a.getAttribute('href'))`);
step("P9-W2-nav-comptable", navCompta.includes("/caisse") && navCompta.includes("/finance"), navCompta.join(","));
await nav("/caisse"); await sleep(800);
step("P9b-acces-caisse-ok", await evalP(`document.body.innerText.includes('Caisse Centrale')`), "comptable accède à /caisse");

const fails = Object.entries(results).filter(([, r]) => !r.ok).map(([k]) => k);
console.log("\n════════ BILAN : " + (Object.keys(results).length - fails.length) + "/" + Object.keys(results).length + " PASS" + (fails.length ? " — ÉCHECS : " + fails.join(", ") : " — MULTI-RÔLES POLYCLINIQUE VÉRIFIÉ ════════"));
try { chrome.kill(); } catch {}
process.exit(fails.length ? 1 : 0);
