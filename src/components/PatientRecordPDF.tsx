import React from 'react';
import { useApp, Patient, Consultation, MedicalRecord, RECORD_TYPE_LABELS } from '../context/AppContext';
import { ConsultationSpecialtyDetails } from './ConsultationSpecialtyDetails';
import { ShieldPlus, User, Activity, FileText, Pill, TestTube, Crosshair, Syringe, Store } from 'lucide-react';

/**
 * Dossier Patient complet — format impression/PDF.
 * Structuré, numéroté, traçable : identité → triage → consultations → résultats.
 */
export function PatientRecordPDF({ patient }: { patient: Patient }) {
  const { hospitalProfile, users } = useApp();
  const records = patient.medicalRecords || [];
  const generatedAt = new Date().toLocaleString('fr-FR');
  const doctorName = (id: string) => users.find(u => u.id === id)?.name || 'Consultant';

  return (
    <div className="print-area bg-white text-stone-900 max-w-[210mm] mx-auto p-8 font-sans text-[13px] leading-relaxed" style={{ fontFamily: 'var(--font-sans)' }}>

      {/* ═══ EN-TÊTE ═══ */}
      <div className="border-b-3 border-stone-900 pb-4 mb-6 flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-stone-900 grid place-items-center">
            <ShieldPlus className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wide">{hospitalProfile.name}</h1>
            <p className="text-xs text-stone-500">{hospitalProfile.city} · {hospitalProfile.phone}</p>
            <p className="text-xs text-stone-400 mt-0.5">République de Guinée — Système Hospitalis</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-stone-500">Dossier généré le</p>
          <p className="font-bold text-sm">{generatedAt}</p>
          <p className="text-[10px] text-stone-400 mt-1 font-mono">{patient.id}</p>
        </div>
      </div>

      {/* ═══ SECTION 1 : IDENTITÉ ═══ */}
      <section className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-widest border-b border-stone-300 pb-1.5 mb-3 flex items-center gap-2">
          <User className="w-4 h-4" /> 1. Identification du Patient
        </h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            ['Nom complet', patient.name],
            ['ID Patient', patient.id],
            ['Âge / Sexe', `${patient.age} ans / ${patient.gender === 'M' ? 'M' : 'F'}`],
            ['Téléphone', patient.phone || '—'],
            ['Père', patient.fatherName || '—'],
            ['Mère', patient.motherName || '—'],
            ['Quartier / Ville', `${patient.neighborhood || '—'}, ${patient.city || '—'}`],
            ['Groupe sanguin', `${patient.bloodGroup || '?'} ${patient.rhFactor || ''}`],
            ['Profession', patient.profession || '—'],
            ['Accompagnant', patient.companionName || '—'],
            ['Contact urgence', patient.companionPhone || '—'],
            ['Statut actuel', patient.status.replace('_', ' ')],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] uppercase tracking-wide text-stone-400 font-bold">{label}</p>
              <p className="font-semibold text-sm">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SECTION 2 : TRIAGE À L'ADMISSION ═══ */}
      {(patient.gynecoTriage || patient.pediatrieTriage) && (
        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-widest border-b border-stone-300 pb-1.5 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" /> 2. Triage à l'Admission
          </h2>
          {patient.gynecoTriage && (
            <div className="bg-rose-50/50 border border-rose-200 rounded-lg p-3 mb-2 text-xs">
              <p className="font-bold text-rose-800 mb-1">Triage Gynéco-Obstétrical</p>
              <div className="grid grid-cols-3 gap-2 text-stone-700">
                <p><strong>Motif :</strong> {patient.gynecoTriage.motifPrincipal}</p>
                <p><strong>Situation :</strong> {patient.gynecoTriage.situationObstetricale}</p>
                <p><strong>G/P :</strong> G{patient.gynecoTriage.grossessesAnterieures} P{patient.gynecoTriage.parites}</p>
                {patient.gynecoTriage.ageGestationnel && <p><strong>AG :</strong> {patient.gynecoTriage.ageGestationnel}</p>}
                {patient.gynecoTriage.urgence && <p className="text-red-600 font-bold">⚠ URGENCE : {patient.gynecoTriage.urgenceDesc}</p>}
              </div>
            </div>
          )}
          {patient.pediatrieTriage && (
            <div className="bg-sky-50/50 border border-sky-200 rounded-lg p-3 text-xs">
              <p className="font-bold text-sky-800 mb-1">Triage Pédiatrique</p>
              <div className="grid grid-cols-3 gap-2 text-stone-700">
                <p><strong>Motif :</strong> {patient.pediatrieTriage.motif}</p>
                <p><strong>Nutrition :</strong> {patient.pediatrieTriage.nutrition}</p>
                <p><strong>Poids est. :</strong> {patient.pediatrieTriage.poidsEstime || '—'} kg</p>
                {patient.pediatrieTriage.urgence && <p className="text-red-600 font-bold">⚠ URGENCE : {patient.pediatrieTriage.urgenceDesc}</p>}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ═══ SECTION 3 : CONSULTATIONS ═══ */}
      <section className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-widest border-b border-stone-300 pb-1.5 mb-3 flex items-center gap-2">
          <Stethoscope className="w-4 h-4" /> 3. Historique des Consultations ({patient.history?.length || 0})
        </h2>
        {(!patient.history || patient.history.length === 0) ? (
          <p className="text-stone-400 italic text-sm">Aucune consultation enregistrée.</p>
        ) : (
          <div className="space-y-4">
            {/* Note : le composant parent doit passer les consultations via un prop ou le contexte */}
            <ConsultationList patientId={patient.id} />
          </div>
        )}
      </section>

      {/* ═══ SECTION 4 : RÉSULTATS & ACTES ═══ */}
      <section className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-widest border-b border-stone-300 pb-1.5 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" /> 4. Résultats d'Examens & Actes ({records.length})
        </h2>
        {records.length === 0 ? (
          <p className="text-stone-400 italic text-sm">Aucun résultat d'examen consigné.</p>
        ) : (
          <div className="space-y-4">
            {[...records].reverse().map((record, idx) => (
              <div key={record.id} className="border border-stone-200 rounded-lg p-4">
                <div className="flex justify-between items-center border-b border-stone-100 pb-2 mb-2">
                  <div>
                    <span className="font-bold text-sm">#{records.length - idx} — {RECORD_TYPE_LABELS[record.type] || record.type}</span>
                    <p className="text-xs text-stone-400">{new Date(record.date).toLocaleString('fr-FR')}</p>
                  </div>
                  <span className="text-[10px] font-mono text-stone-400">{record.id}</span>
                </div>
                <p className="font-semibold text-sm mb-2">{record.summary}</p>

                {/* Tableau ISO 15189 pour résultats labo */}
                {record.type === 'lab_result' && record.details?.results && (
                  <table className="w-full text-xs border-collapse border border-stone-300">
                    <thead>
                      <tr className="bg-stone-100 border-b border-stone-300">
                        <th className="p-1.5 text-left border-r">Paramètre</th>
                        <th className="p-1.5 text-left border-r">Résultat</th>
                        <th className="p-1.5 text-left border-r">Unité</th>
                        <th className="p-1.5 text-left">Référence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.details.results.map((res, i) => (
                        <tr key={i} className={res.flag !== 'normal' ? 'text-red-600 font-bold' : ''}>
                          <td className="p-1.5 border-r border-b border-stone-200">{res.param} {res.flag === 'high' ? '↑' : res.flag === 'low' ? '↓' : ''}</td>
                          <td className="p-1.5 border-r border-b border-stone-200">{res.result}</td>
                          <td className="p-1.5 border-r border-b border-stone-200">{res.unit}</td>
                          <td className="p-1.5 border-b border-stone-200">{res.reference}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {record.type === 'lab_result' && record.details?.notes && (
                  <p className="text-xs text-stone-600 italic mt-2">Notes : {record.details.notes}</p>
                )}

                {/* Key-value pour autres types */}
                {record.type !== 'lab_result' && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(record.details).map(([key, value]) => (
                      <div key={key}>
                        <span className="font-semibold text-stone-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()} : </span>
                        <span>{String(value) || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ═══ PIED DE PAGE ═══ */}
      <footer className="border-t-2 border-stone-900 pt-3 mt-8 flex justify-between items-end text-[10px] text-stone-500">
        <div>
          <p>Document généré par Hospitalis — {hospitalProfile.name}</p>
          <p>{records.length} résultat(s) · {patient.history?.length || 0} consultation(s) · ID : {patient.id}</p>
        </div>
        <div className="text-center">
          <p className="uppercase tracking-widest font-bold mb-8">Cachet et Signature</p>
          <div className="w-48 border-b border-stone-400"></div>
        </div>
      </footer>
    </div>
  );
}

// Sous-composant pour la liste des consultations (utilise le contexte)
function ConsultationList({ patientId }: { patientId: string }) {
  const { consultations, patients } = useApp();
  const { users } = useApp();
  const patient = patients.find(p => p.id === patientId);
  const patientConsultations = consultations.filter(c => patient?.history?.includes(c.id));

  if (patientConsultations.length === 0) return <p className="text-stone-400 italic text-sm">—</p>;

  return (
    <>
      {patientConsultations.map((cons, idx) => {
        const doctorName = users.find(u => u.id === cons.doctorId)?.name || 'Consultant';
        return (
          <div key={cons.id} className="border border-stone-200 rounded-lg p-4 relative">
            <div className="flex justify-between items-start border-b border-stone-100 pb-2 mb-3">
              <div>
                <span className="font-bold text-sm">Consultation #{patientConsultations.length - idx}</span>
                <p className="text-xs text-stone-400">{new Date(cons.date).toLocaleString('fr-FR')} · Dr. {doctorName}</p>
              </div>
              <span className="text-[10px] font-mono text-stone-400">{cons.id}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><strong>Motif :</strong> {cons.chiefComplaint || '—'}</div>
              <div><strong>Diagnostic :</strong> {cons.finalDiagnosis || '—'}</div>
            </div>

            {/* Constantes vitales */}
            {cons.vitals && Object.values(cons.vitals).some(v => v) && (
              <div className="grid grid-cols-4 gap-2 text-xs mt-3 bg-stone-50 p-2 rounded border border-stone-100">
                <div><strong>T° :</strong> {cons.vitals.temperature || '—'}</div>
                <div><strong>TA :</strong> {cons.vitals.bloodPressure || '—'}</div>
                <div><strong>Pouls :</strong> {cons.vitals.heartRate || '—'}</div>
                <div><strong>Poids :</strong> {cons.vitals.weight || '—'} kg</div>
                {cons.vitals.height && <div><strong>Taille :</strong> {cons.vitals.height} cm</div>}
                {cons.vitals.bmi && <div><strong>IMC :</strong> {cons.vitals.bmi}</div>}
                {cons.vitals.o2Saturation && <div><strong>SpO2 :</strong> {cons.vitals.o2Saturation}%</div>}
                {cons.vitals.pc && <div><strong>PC :</strong> {cons.vitals.pc} cm</div>}
              </div>
            )}

            {/* Antécédents */}
            {cons.historyCards && Object.values(cons.historyCards).some(v => v) && (
              <div className="mt-3 text-xs space-y-1">
                {cons.historyCards.medical && <p><strong>ATCD médicaux :</strong> {cons.historyCards.medical}</p>}
                {cons.historyCards.surgical && <p><strong>ATCD chirurgicaux :</strong> {cons.historyCards.surgical}</p>}
                {cons.historyCards.family && <p><strong>ATCD familiaux :</strong> {cons.historyCards.family}</p>}
                {cons.historyCards.allergies && <p><strong>Allergies :</strong> {cons.historyCards.allergies}</p>}
              </div>
            )}

            {/* Examen physique */}
            {cons.physicalExam && Object.values(cons.physicalExam).some(v => v) && (
              <div className="mt-3 text-xs space-y-1">
                {cons.physicalExam.inspection && <p><strong>Inspection :</strong> {cons.physicalExam.inspection}</p>}
                {cons.physicalExam.palpation && <p><strong>Palpation :</strong> {cons.physicalExam.palpation}</p>}
                {cons.physicalExam.auscultation && <p><strong>Auscultation :</strong> {cons.physicalExam.auscultation}</p>}
              </div>
            )}

            {/* Détails spécialité */}
            {cons.specialtyType && cons.specialtyData && (
              <div className="mt-3">
                <ConsultationSpecialtyDetails cons={cons} />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// Icône manquante
import { Stethoscope } from 'lucide-react';
