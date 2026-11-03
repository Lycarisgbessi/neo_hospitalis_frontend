import React from 'react';
import { FileText, Activity } from 'lucide-react';
import { MedicalRecord, LabResultRow, RECORD_TYPE_LABELS } from '../context/AppContext';

/**
 * Dossier médical longitudinal du patient : résultats de laboratoire (tableau
 * ISO 15189), comptes-rendus d'imagerie, soins infirmiers, dispensations,
 * CPN, vaccinations… Rendu identique sur toutes les pages de consultation
 * (Médecine, Gynéco, Pédiatrie) — corrige l'audit B2 (résultats paracliniques
 * invisibles en spécialité).
 */
export function RecordsTimeline({ records }: { records?: MedicalRecord[] }) {
  if (!records || records.length === 0) {
    return (
      <p className="text-slate-500 italic text-sm p-4 bg-slate-50 rounded-xl border border-dashed">
        Aucun résultat d'examen ou acte médical consigné.
      </p>
    );
  }

  return (
    <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6">
      {records.map((record: MedicalRecord) => (
        <div key={record.id} className="relative p-5 border border-slate-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
          <div className="absolute -left-[35px] top-5 w-4 h-4 rounded-full bg-purple-500 border-4 border-white shadow-sm" />
          <div className="flex justify-between items-start pb-3 border-b border-slate-100 mb-3">
            <div>
              <div className="font-bold text-slate-800">
                {new Date(record.date).toLocaleDateString()}
              </div>
              <div className="text-xs text-purple-600 font-semibold uppercase tracking-wider mt-1 flex items-center">
                <Activity className="w-3 h-3 mr-1" /> {RECORD_TYPE_LABELS[record.type] || record.type}
              </div>
            </div>
          </div>
          <div className="text-sm space-y-3">
            <div className="font-semibold text-slate-700">{record.summary}</div>

            {record.type === 'lab_result' && record.details?.results && (
              <div className="bg-slate-50 p-3 rounded border border-slate-100 text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="pb-1">Paramètre</th>
                      <th className="pb-1">Résultat</th>
                      <th className="pb-1">Unité</th>
                      <th className="pb-1">Réf.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.details.results.map((res: LabResultRow, idx: number) => (
                      <tr key={idx} className={res.flag !== 'normal' ? 'text-red-600 font-medium' : ''}>
                        <td className="py-1 border-b border-slate-100">{res.param} {res.flag === 'high' ? '(H)' : res.flag === 'low' ? '(L)' : ''}</td>
                        <td className="py-1 border-b border-slate-100">{res.result}</td>
                        <td className="py-1 border-b border-slate-100 text-slate-500">{res.unit}</td>
                        <td className="py-1 border-b border-slate-100 text-slate-400">{res.reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {record.details.notes && <div className="mt-2 text-slate-600 italic">Notes: {record.details.notes}</div>}
              </div>
            )}

            {record.type !== 'lab_result' && (
              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded border border-slate-100">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(record.details).map(([key, value]) => (
                    <div key={key}>
                      <span className="font-semibold text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()} : </span>
                      <span className="text-slate-800">{value === null || value === undefined || value === '' ? '-' : String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )).reverse()}
    </div>
  );
}

/** En-tête de section standardisé pour le dossier patient. */
export function RecordsSectionTitle({ count }: { count: number }) {
  return (
    <h3 className="text-lg font-semibold mb-4 flex items-center mt-8">
      <FileText className="w-5 h-5 mr-2 text-slate-500" /> Dossier Patient & Résultats ({count})
    </h3>
  );
}
