import React from 'react';
import { Consultation } from '../context/AppContext';

const s = (v: unknown): string => (v === undefined || v === null || v === '' ? '-' : String(v));
const cls = (bg: string, text: string, border: string) => `text-sm text-slate-600 ${bg} p-3 rounded-lg border ${border} mt-2 space-y-1`;

/**
 * Détail spécialisé d'une consultation, rendu de façon IDENTIQUE sur les trois
 * pages de consultation (Médecine, Gynéco, Pédiatrie) — audit X1 : une
 * consultation CPN, obstétricale, vaccinale ou néonatale reste lisible quel que
 * soit le service qui la consulte (circulation médecin → médecin).
 */
export function ConsultationSpecialtyDetails({ cons }: { cons: Consultation }) {
  if (!cons.specialtyType || !cons.specialtyData) return null;
  const d = cons.specialtyData;

  switch (cons.specialtyType) {
    case 'gyneco':
      return (
        <div className={cls('bg-rose-50', 'text-rose-800', 'border-rose-100')}>
          <p><strong>Examen Gynéco :</strong> TV : {s(d.tv)}, Spéculum : {s(d.speculum)}, Mammaire : {s(d.mammaire)}</p>
          <p><strong>Symptômes :</strong> Douleurs : {s(d.douleurs)} | Saignements : {s(d.saignements)} | Cycle : {s(d.troublesCycle)}</p>
        </div>
      );

    case 'cpn':
    case 'suivi':
      return (
        <div className={cls('bg-purple-50', 'text-purple-800', 'border-purple-100')}>
          <p><strong>{cons.specialtyType === 'cpn' ? s(d.typeCpn) : 'Suivi de grossesse'} ({s(d.sa)} SA) :</strong> BCF : {s(d.bcf)} bpm, HU : {s(d.hu)} cm, MAF : {s(d.maf)}, Présentation : {s(d.presentation)}</p>
          <p><strong>Dépistage :</strong> Protéinurie : {s(d.proteinesUrine)} | Œdèmes : {s(d.oedemes)} {d.echo ? `| Écho : ${s(d.echo)}` : ''}</p>
        </div>
      );

    case 'accouchement':
      return (
        <div className={cls('bg-indigo-50', 'text-indigo-800', 'border-indigo-100')}>
          <p><strong>Accouchement ({s(d.mode)}) :</strong> Né le {s(d.dateNaissance)}, Sexe : {s(d.sexe)}, Poids : {s(d.poidsNouveauNe)} g, Apgar : {s(d.apgar)}</p>
          <p><strong>Travail :</strong> Dilatation : {s(d.dilatation)} cm | Membranes : {s(d.membranes)} {d.delivrance ? `| Délivrance : ${s(d.delivrance)}` : ''}</p>
        </div>
      );

    case 'pf':
      return (
        <div className={cls('bg-teal-50', 'text-teal-800', 'border-teal-100')}>
          <p><strong>Planification Familiale :</strong> Méthode choisie : {s(d.methodeChoisie)} | Antérieure : {s(d.methodeAnterieure)} | Objectif : {s(d.desirDEnfant)}</p>
        </div>
      );

    case 'postpartum':
      return (
        <div className={cls('bg-orange-50', 'text-orange-800', 'border-orange-100')}>
          <p><strong>Suivi Post-Partum :</strong> Involution : {s(d.involution)} | Lochies : {s(d.lochies)} | Cicatrice/Périnée : {s(d.cicatrice)} | Allaitement : {s(d.allaitement)}</p>
        </div>
      );

    case 'croissance':
      return (
        <div className={cls('bg-emerald-50', 'text-emerald-800', 'border-emerald-100')}>
          <p><strong>Croissance :</strong> Poids/Taille : {s(cons.vitals?.weight)}/{s(cons.vitals?.height)} | Courbes : {s(d.courbes)}</p>
          <p><strong>Développement :</strong> Tête : {s(d.tenueTete)} | Assis : {s(d.positionAssise)} | Marche : {s(d.marche)} | Langage : {s(d.langage)} | Dentition : {s(d.dentition)}</p>
          <p><strong>Nutrition :</strong> {s(d.alimentationType)} ({s(d.nbRepas)} repas/j) | Appétit : {s(d.qualiteAppetit)}</p>
        </div>
      );

    case 'vaccination':
      return (
        <div className={cls('bg-amber-50', 'text-amber-800', 'border-amber-100')}>
          <p><strong>Vaccination (PEV) :</strong> Carnet : {s(d.carnetAJour)} | BCG/Polio0 : {d.bcgPolio0 ? '✓' : '✗'} | Penta : {d.penta1 ? '✓' : '✗'}{d.penta2 ? '✓' : '✗'}{d.penta3 ? '✓' : '✗'} | Rota : {d.rotavirus ? '✓' : '✗'} | Pneumo : {d.pneumocoque ? '✓' : '✗'} | RR/FJ : {d.rrFj ? '✓' : '✗'}</p>
          <p><strong>Fait ce jour :</strong> {s(d.vaccinsCeJour)} | <strong>Prochainement :</strong> {s(d.prochainsVaccins)}</p>
        </div>
      );

    case 'neonat':
      return (
        <div className={cls('bg-indigo-50', 'text-indigo-800', 'border-indigo-100')}>
          <p><strong>Néonatalogie :</strong> Apgar : {s(d.apgar1)}/{s(d.apgar5)}/{s(d.apgar10)} | Silverman : {s(d.silverman)} | Réanimation : {s(d.reanimation)}</p>
          <p><strong>Examen :</strong> Cri : {s(d.cri)} | Tonus : {s(d.tonus)} | Réflexes : {s(d.reflexesArchaiques)} | Ictère : {s(d.ictere)} | Mensurations : {s(d.mensurationsNaiss)}</p>
          <p><strong>Contexte :</strong> Grossesse : {s(d.deroulementGrossesse)} | Mode : {s(d.modeAccouchement)} | LA : {s(d.liquideAmniotique)}</p>
        </div>
      );

    // Consultation pédiatrique générale (examen système par système)
    case 'generale':
      return d.orl || d.cardio || d.abdo ? (
        <div className={cls('bg-sky-50', 'text-sky-800', 'border-sky-100')}>
          <p><strong>Pédiatrie :</strong> État : {s(d.etatGeneral)} | Conscience : {s(d.conscience)} | ORL : {s(d.orl)} | Otoscopie : {s(d.otoscopie)}</p>
          <p><strong>Respiratoire :</strong> {s(d.pleuropulmonaire)} {d.signesDeLutte ? `(Lutte : ${s(d.signesDeLutte)})` : ''} | <strong>Cardio :</strong> {s(d.cardio)} | TRC : {s(d.trc)}</p>
          <p><strong>Abdomen :</strong> {s(d.abdo)} | Hépato-spléno : {s(d.hepatoSplenomegalie)} | <strong>Neuro :</strong> {s(d.neuro)} | <strong>Peau :</strong> {s(d.cutane)}</p>
        </div>
      ) : null;

    default:
      return null;
  }
}
