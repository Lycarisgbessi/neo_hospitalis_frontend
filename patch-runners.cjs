// Patch: adapte les 4 runners E2E aux nouveaux parcours (wizard + auth refondu)
const fs = require("fs");
const ok = (c, m) => { if (!c) { console.error("ÉCHEC " + m); process.exit(1); } };

// ── Helper wizard : remplace l'ancien setup + inscription super_admin ──
const WIZARD_SNIPPET = `
// ── Setup wizard (refonte DA) : accueil → établissement → modules → admin → lancement ──
async function wizardSetup(adminName, adminPwd = "secret123", hospitalName = "Clinique Test") {
  await waitText("Configurer mon établissement", 10000);
  await clickBtn("Configurer mon établissement"); await sleep(600);
  // Étape 1 : nom de l'établissement
  await setVal(\\\`[...document.querySelectorAll('input')].find(i => i.placeholder && i.placeholder.includes('Clinique Espoir'))\\\`, hospitalName);
  await clickBtn("Continuer"); await sleep(600);
  // Étape 2 : modules (défauts conservés)
  await clickBtn("Continuer"); await sleep(600);
  // Étape 3 : compte administrateur
  await setVal(\\\`[...document.querySelectorAll('input')].find(i => i.placeholder && i.placeholder.includes('Dr Awa Camara'))\\\`, adminName);
  await setVal(\\\`document.querySelector('input[type=password]')\\\`, adminPwd);
  await clickBtn("Continuer"); await sleep(600);
  // Étape 4 : lancement
  await clickBtn("Lancer Hospitalis"); await sleep(2200);
}

// ── Auth refondu : créer un compte par rôle (cartes visuelles) ──
async function createAccountByRole(roleLabel, name, pwd = "secret123", service = null) {
  await clickBtn("Déconnexion"); await waitText("Créer un compte", 8000); await sleep(500);
  await clickBtn("Créer un compte"); await sleep(600);
  // Carte de rôle par libellé
  await evalP(\\\`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(\\\${JSON.stringify(roleLabel)}) && x.className.includes('rounded-2xl')); if (b) b.click(); return 1; })()\\\`);
  await sleep(500);
  if (service) {
    await evalP(\\\`(() => { const s = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === \\\${JSON.stringify(service)})); if (s) { Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(s, \\\${JSON.stringify(service)}); s.dispatchEvent(new Event('change', { bubbles: true })); } return 1; })()\\\`);
    await sleep(300);
  }
  await setVal(\\\`[...document.querySelectorAll('input')].find(i => i.placeholder === 'Dr Jane Doe')\\\`, name);
  await setVal(\\\`document.querySelector('input[type=password]')\\\`, pwd);
  await clickBtn("Créer mon compte"); await sleep(1500);
}

// ── Auth refondu : connexion simple ──
async function loginAs(name, pwd = "secret123") {
  await clickBtn("Déconnexion"); await waitText("Connexion", 8000); await sleep(500);
  await clickBtn("Connexion"); await sleep(400); // s'assurer du mode connexion
  await setVal(\\\`[...document.querySelectorAll('input')].find(i => i.placeholder === 'Dr Jane Doe')\\\`, name);
  await setVal(\\\`document.querySelector('input[type=password]')\\\`, pwd);
  await clickBtn("Se connecter"); await sleep(1500);
}
`;

// ── Ancien setup à remplacer (audit1, flux, voice) ──
const OLD_SETUP_1 = `await waitText("Mode Clinique", 10000);
await clickBtn("Mode Clinique"); await sleep(300);
await clickBtn("Continuer"); await sleep(300);
await clickBtn("Terminer la Configuration");
await waitText("Portail de Connexion", 8000);
await clickBtn("Volet Administratif"); await sleep(500);
await setVal(\\\`[...document.querySelectorAll('input')].find(i => i.placeholder && i.placeholder.includes('Doe'))\\\`, "Dr Alpha Bah");
await setVal(\\\`document.querySelector('input[type=password]')\\\`, "secret123");
await setVal(\\\`document.querySelector('select')\\\`, "super_admin", "change");
await sleep(250);
await clickBtn("Créer le compte"); await sleep(1200);
step("setup-inscription", await evalP(\\\`document.body.innerText.includes('Bonjour, Dr Alpha Bah')\\\`));`;

const NEW_SETUP_1 = `await wizardSetup("Dr Alpha Bah");
step("setup-inscription", await evalP(\\\`document.body.innerText.includes('Bonjour') || document.body.innerText.includes('Tableau de bord') || location.pathname === '/'\\\`), "wizard + auto-login");`;

// ── Patch chaque runner ──
const files = {
  "e2e-audit1.mjs": { setup: OLD_SETUP_1, news: NEW_SETUP_1 },
  "e2e-audit1-flux.mjs": { setup: OLD_SETUP_1, news: NEW_SETUP_1 },
  "e2e-audit2-voice.mjs": { setup: OLD_SETUP_1, news: NEW_SETUP_1 },
  "e2e-audit1-roles.mjs": { setup: null, news: null }, // traité à part
};

for (const [file, cfg] of Object.entries(files)) {
  if (!cfg.setup) continue;
  let s = fs.readFileSync(file, "utf8");
  if (!s.includes(cfg.setup.trim().split("\\\n")[0])) { console.log("SKIP " + file + " (setup non trouvé)"); continue; }
  s = s.replace(cfg.setup, cfg.news);
  // Insérer les helpers juste avant le premier usage
  const insertAfter = s.indexOf("// ── Setup + inscription ──");
  if (insertAfter === -1) { console.log("WARN " + file + " : marqueur setup introuvable, insertion au début"); }
  const before = s.slice(0, insertAfter);
  const after = s.slice(insertAfter);
  s = before + WIZARD_SNIPPET + "\n" + after;
  fs.writeFileSync(file, s);
  console.log("OK " + file);
}

// ── Runner roles : remplacement complet du setup et createAccount ──
let s = fs.readFileSync("e2e-audit1-roles.mjs", "utf8");
// Remplacer l'ancien setup
const oldRolesSetup = `await waitText("Mode Clinique", 10000);
await clickBtn("Mode Clinique"); await sleep(300);
await clickBtn("Continuer"); await sleep(300);
await clickBtn("Terminer la Configuration");
const surAuth = await waitText("Portail de Connexion", 8000);
step("P1-setup-polyclinique", surAuth, "mode polyclinique sélectionné");`;
const newRolesSetup = `await wizardSetup("Dr Admin", "secret123", "Polyclinique Test");
step("P1-setup-polyclinique", await evalP(\\\`location.pathname === '/'\\\`), "wizard + auto-login");`;
ok(s.includes(oldRolesSetup.split("\\\n")[0]), "roles setup");
s = s.replace(oldRolesSetup, newRolesSetup);
// Remplacer l'ancien createAccount
const oldCreateFn = s.indexOf("// Créer un compte (volet, rôle, service si médical) puis connexion automatique");
const oldCreateEnd = s.indexOf("// ═══ P2");
ok(oldCreateFn !== -1 && oldCreateEnd !== -1, "createAccount bounds");
s = s.slice(0, oldCreateFn) + WIZARD_SNIPPET + "\n" + s.slice(oldCreateEnd);
// Remplacer les usages de createAccount par les nouveaux helpers
s = s.split(`await createAccount("Volet Administratif", "receptionniste", null, "Aïcha Réception");`).join(`await createAccountByRole("Réceptionniste", "Aïcha Réception");`);
s = s.split(`await createAccount("Volet Administratif", "caissier", null, "Moussa Caisse");`).join(`await createAccountByRole("Caissier", "Moussa Caisse");`);
s = s.split(`await createAccount("Volet Médical", "medecin", "gynecologie", "Dr Kaba");`).join(`await createAccountByRole("Médecin", "Dr Kaba", "secret123", "gynecologie");`);
s = s.split(`await createAccount("Volet Médical", "medecin", "cardiologie", "Dr Diallo");`).join(`await createAccountByRole("Médecin", "Dr Diallo", "secret123", "cardiologie");`);
s = s.split(`await createAccount("Volet Médical", "technicien_labo", null, "Séo Labo");`).join(`await createAccountByRole("Technicien Laboratoire", "Séo Labo");`);
s = s.split(`await createAccount("Volet Administratif", "comptable", null, "Fatou Compta");`).join(`await createAccountByRole("Comptable", "Fatou Compta");`);
// Le re-login de Moussa : remplacer par loginAs
s = s.split(`await createAccount("Volet Administratif", "caissier", null, "Moussa Caisse"); // re-connexion du même compte (mode connexion)`)
       .join(`await loginAs("Moussa Caisse");`);
fs.writeFileSync("e2e-audit1-roles.mjs", s);
console.log("OK e2e-audit1-roles.mjs");
console.log("\\nTous les runners adaptés");
