import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Badge } from './ui/Badge';
import { Plus, Trash2, Printer, Check, X, FileText, Pill, TestTube, Syringe, HeartPulse, Activity } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface PrescriptionBuilderProps {
  type: 'pharmacy' | 'lab' | 'imagerie' | 'nursing' | null;
  onClose: () => void;
  onSubmit: (details: string, fee: number) => void;
  patientName: string;
  patientAge: string;
  patientGender: string;
}

interface Medication { name: string; dosage: string; form: string; frequency: string; duration: string; instructions: string; }

export function PrescriptionBuilder({ type, onClose, onSubmit, patientName, patientAge, patientGender }: PrescriptionBuilderProps) {
  const { currentUser, hospitalProfile } = useApp();
  const [medications, setMedications] = useState<Medication[]>([{ name: '', dosage: '', form: '', frequency: '', duration: '', instructions: '' }]);
  const [labTests, setLabTests] = useState<string[]>([]);
  const [otherLabTests, setOtherLabTests] = useState('');
  const [imagerieType, setImagerieType] = useState('');
  const [imagerieRegion, setImagerieRegion] = useState('');
  const [imagerieIndication, setImagerieIndication] = useState('');
  const [nursingCare, setNursingCare] = useState('');
  const [fee, setFee] = useState('');

  if (!type) return null;

  const today = new Date().toLocaleDateString('fr-FR');

  const addMedication = () => setMedications([...medications, { name: '', dosage: '', form: '', frequency: '', duration: '', instructions: '' }]);
  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    const newMeds = [...medications]; newMeds[index][field] = value; setMedications(newMeds);
  };
  const removeMedication = (index: number) => {
    const newMeds = medications.filter((_, i) => i !== index);
    setMedications(newMeds.length ? newMeds : [{ name: '', dosage: '', form: '', frequency: '', duration: '', instructions: '' }]);
  };

  const generateDetails = () => {
    if (type === 'pharmacy') return medications.map(m => `${m.name} ${m.dosage} ${m.form} - ${m.frequency} pdt ${m.duration} (${m.instructions})`).join('\n');
    if (type === 'lab') {
      const tests = [...labTests]; if (otherLabTests) tests.push(`Autre: ${otherLabTests}`);
      return `Analyses demandées :\n` + tests.map(t => `- ${t}`).join('\n');
    }
    if (type === 'imagerie') return `Type: ${imagerieType}\nRégion: ${imagerieRegion}\nIndication Clinique: ${imagerieIndication}`;
    if (type === 'nursing') return nursingCare;
    return '';
  };

  const handleSubmit = () => {
    onSubmit(generateDetails(), parseInt(fee) || 0);
  };

  const getTitleInfo = () => {
    switch (type) {
      case 'pharmacy': return { title: 'Ordonnance Médicale', icon: Pill, color: 'text-emerald-600', bg: 'bg-emerald-50' };
      case 'lab': return { title: 'Prescription de Biologie', icon: TestTube, color: 'text-violet-600', bg: 'bg-violet-50' };
      case 'imagerie': return { title: 'Demande d\'Examen d\'Imagerie', icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50' };
      case 'nursing': return { title: 'Prescription de Soins Infirmiers', icon: Syringe, color: 'text-rose-600', bg: 'bg-rose-50' };
      default: return { title: 'Prescription', icon: FileText, color: 'text-slate-600', bg: 'bg-slate-50' };
    }
  };

  const { title, icon: Icon, color, bg } = getTitleInfo();

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm p-2 md:p-6 lg:p-8 flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white w-full h-full max-h-full rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden flex-1 max-w-[1600px] animate-in zoom-in-95 duration-300">
        
        {/* Editor Section (Left) */}
        <div className="w-full md:w-1/2 lg:w-7/12 border-r border-slate-200 flex flex-col h-full bg-slate-50/50">
        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${bg} mr-3`}><Icon className={`w-6 h-6 ${color}`} /></div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{title}</h2>
              <p className="text-sm text-slate-500">Edition en cours pour <span className="font-semibold text-slate-700">{patientName}</span></p>
            </div>
          </div>
          <Button variant="ghost" onClick={onClose} className="rounded-full w-10 h-10 p-0 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Content specific to type */}
          {type === 'pharmacy' && (
            <div className="space-y-6">
              {medications.map((med, index) => (
                <div key={index} className="p-5 border border-emerald-100 bg-white rounded-xl shadow-sm relative group">
                  <div className="absolute -top-3 left-4 bg-white px-2 text-xs font-bold text-emerald-600 uppercase tracking-widest">Traitement #{index + 1}</div>
                  <Button variant="ghost" className="absolute top-2 right-2 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 p-0" onClick={() => removeMedication(index)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  
                  <div className="grid grid-cols-12 gap-4 mt-2">
                    <div className="col-span-12 md:col-span-5">
                      <label className="text-[11px] font-semibold uppercase text-slate-500 mb-1 block">Médicament (DCI ou Spécialité)</label>
                      <Input value={med.name} onChange={e => updateMedication(index, 'name', e.target.value)} placeholder="Ex: Paracétamol" className="border-slate-300 focus-visible:ring-emerald-500" />
                    </div>
                    <div className="col-span-6 md:col-span-3">
                      <label className="text-[11px] font-semibold uppercase text-slate-500 mb-1 block">Dosage</label>
                      <Input value={med.dosage} onChange={e => updateMedication(index, 'dosage', e.target.value)} placeholder="Ex: 1000mg" className="border-slate-300 focus-visible:ring-emerald-500" />
                    </div>
                    <div className="col-span-6 md:col-span-4">
                      <label className="text-[11px] font-semibold uppercase text-slate-500 mb-1 block">Forme</label>
                      <Input value={med.form} onChange={e => updateMedication(index, 'form', e.target.value)} placeholder="Ex: Comprimé" className="border-slate-300 focus-visible:ring-emerald-500" />
                    </div>
                    <div className="col-span-6 md:col-span-4">
                      <label className="text-[11px] font-semibold uppercase text-slate-500 mb-1 block">Posologie / Fréquence</label>
                      <Input value={med.frequency} onChange={e => updateMedication(index, 'frequency', e.target.value)} placeholder="Ex: 1 matin, 1 soir" className="border-slate-300 focus-visible:ring-emerald-500" />
                    </div>
                    <div className="col-span-6 md:col-span-3">
                      <label className="text-[11px] font-semibold uppercase text-slate-500 mb-1 block">Durée</label>
                      <Input value={med.duration} onChange={e => updateMedication(index, 'duration', e.target.value)} placeholder="Ex: 5 jours" className="border-slate-300 focus-visible:ring-emerald-500" />
                    </div>
                    <div className="col-span-12 md:col-span-5">
                      <label className="text-[11px] font-semibold uppercase text-slate-500 mb-1 block">Observations / Instructions</label>
                      <Input value={med.instructions} onChange={e => updateMedication(index, 'instructions', e.target.value)} placeholder="Ex: Au cours du repas" className="border-slate-300 focus-visible:ring-emerald-500" />
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addMedication} className="w-full border-dashed border-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 py-8">
                <Plus className="w-5 h-5 mr-2" /> Ajouter un autre médicament
              </Button>
            </div>
          )}

          {type === 'lab' && (
             <div className="space-y-6">
               <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                 {['NFS', 'Groupage sanguin', 'Glycémie à jeun', 'Créatininémie', 'Transaminases (ASAT/ALAT)', 'Ionogramme sanguin', 'CRP', 'VS', 'Test de Grossesse (B-HCG)', 'Goutte épaisse'].map(test => (
                   <label key={test} className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${labTests.includes(test) ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500' : 'border-slate-200 bg-white hover:border-violet-300'}`}>
                     <input type="checkbox" className="mr-3 w-4 h-4 text-violet-600 focus:ring-violet-500 rounded" checked={labTests.includes(test)} onChange={() => setLabTests(prev => prev.includes(test) ? prev.filter(t => t !== test) : [...prev, test])} />
                     <span className={`text-sm font-medium ${labTests.includes(test) ? 'text-violet-900' : 'text-slate-700'}`}>{test}</span>
                   </label>
                 ))}
               </div>
               <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Analyses Spécifiques / Autres</label>
                  <Textarea value={otherLabTests} onChange={e => setOtherLabTests(e.target.value)} placeholder="Précisez tout autre bilan biologique requis..." className="min-h-[120px] text-base border-slate-300 focus-visible:ring-violet-500" />
               </div>
             </div>
          )}

          {type === 'imagerie' && (
             <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Modalité (Type d'examen)</label>
                  <select className="w-full h-9 rounded-md border border-slate-300 bg-white px-4 text-slate-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" value={imagerieType} onChange={e => setImagerieType(e.target.value)}>
                    <option value="">Sélectionner une modalité...</option>
                    <option value="Radiologie Standard (RX)">Radiologie Standard (RX)</option>
                    <option value="Échographie">Échographie</option>
                    <option value="Scanner (TDM)">Scanner (TDM)</option>
                    <option value="IRM">IRM</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Région Anatomique</label>
                  <Input value={imagerieRegion} onChange={e => setImagerieRegion(e.target.value)} placeholder="Ex: Thorax, Abdomen, Genou droit..." className="h-12 text-base border-slate-300 focus-visible:ring-amber-500" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Renseignements Cliniques (Indication)</label>
                  <Textarea value={imagerieIndication} onChange={e => setImagerieIndication(e.target.value)} placeholder="Ex: Toux persistante avec fièvre, suspicion de fracture..." className="min-h-[120px] text-base border-slate-300 focus-visible:ring-amber-500" />
                </div>
             </div>
          )}

          {type === 'nursing' && (
             <div>
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Détails des Soins / Actes</label>
                <Textarea value={nursingCare} onChange={e => setNursingCare(e.target.value)} placeholder="Décrire les soins à prodiguer (pansement, injection, perfusion...)" className="min-h-[200px] text-base border-slate-300 focus-visible:ring-rose-500" />
             </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-white shrink-0 flex justify-between items-center bg-slate-50">
           <div className="flex items-center space-x-3 w-1/3">
             <label className="text-xs font-semibold text-slate-500 uppercase">Tarification Estimée (GNF)</label>
             <Input type="number" value={fee} onChange={e => setFee(e.target.value)} placeholder="Auto..." className="w-32 bg-white" />
           </div>
           <div className="space-x-3">
              <Button variant="outline" onClick={onClose} size="lg">Annuler</Button>
              <Button className="bg-slate-900 hover:bg-slate-800 shadow-xl" size="lg" onClick={handleSubmit}>
                 <Check className="w-5 h-5 mr-2"/> Valider & Enregistrer
              </Button>
           </div>
        </div>
      </div>

      {/* Preview Section (Right - PDF Simulator) */}
      <div className="hidden md:flex md:w-1/2 lg:w-5/12 bg-slate-200/80 p-8 items-center justify-center overflow-y-auto relative">
         <div className="absolute top-4 right-4 flex space-x-2">
            <Badge variant="outline" className="bg-white/80 backdrop-blur-md shadow-sm border-slate-300 text-slate-700">Aperçu du document final</Badge>
         </div>
         <div className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-xl rounded-sm p-[20mm] font-serif text-slate-900 flex flex-col relative transform scale-[0.85] origin-top md:scale-90 lg:scale-[0.8] xl:scale-100">
            {/* Watermark Logo */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
               <Activity className="w-[400px] h-[400px] text-slate-900" />
            </div>

            <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-8 relative z-10">
               <div className="flex flex-col">
                  <div className="flex items-center space-x-3 mb-2">
                     <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center rounded-sm">
                        <Activity className="w-6 h-6" />
                     </div>
                     <div>
                        <h1 className="text-2xl font-black uppercase tracking-widest text-slate-900 leading-tight">{hospitalProfile.name}</h1>
                        <p className="text-[10px] tracking-widest text-slate-500 uppercase font-sans">République de Guinée</p>
                     </div>
                  </div>
                  <p className="text-sm text-slate-600 mt-2">{hospitalProfile.city} — République de Guinée</p>
                  <p className="text-sm text-slate-600 mb-1">Commune de Kaloum, Conakry</p>
                  <p className="text-sm text-slate-500 font-sans">Tél: {hospitalProfile.phone || "—"}</p>
               </div>
               <div className="text-right">
                  <p className="font-bold text-lg text-slate-900">Dr. {currentUser?.name}</p>
                  <p className="text-sm text-slate-600 font-sans tracking-wide">{currentUser?.service || 'Médecine Générale'}</p>
                  <p className="text-xs text-slate-500 font-sans mt-2">Ordre Médical: ONMG-12345</p>
               </div>
            </div>

            <div className="flex justify-between items-center mb-8 bg-slate-50 p-4 border border-slate-200 rounded-sm relative z-10">
               <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-sans mb-1">Informations du Patient</p>
                  <p className="font-bold text-xl text-slate-900">{patientName}</p>
                  <p className="font-sans text-sm text-slate-600 mt-1">{patientAge} ans • Sexe: {patientGender === 'M' ? 'Masculin' : 'Féminin'}</p>
               </div>
               <div className="text-right">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-sans mb-1">Date d'édition</p>
                  <p className="font-bold text-lg text-slate-800">{today}</p>
               </div>
            </div>

            <div className="text-center mb-10 relative z-10">
               <h2 className="text-2xl font-black uppercase tracking-[0.3em] text-slate-900 border-y-2 border-slate-900 py-4 block mx-auto w-full px-4">{title}</h2>
            </div>

            <div className="flex-1 text-base leading-relaxed space-y-8 relative z-10">
               {type === 'pharmacy' && (
                 <>
                    {medications.some(m => m.name) && <div className="font-bold text-4xl font-serif italic text-slate-800 mb-6">Rx.</div>}
                    {medications.map((m, i) => m.name && (
                      <div key={i} className="flex flex-col pl-4 border-l-2 border-slate-300">
                         <div className="flex items-baseline space-x-2">
                            <span className="font-bold text-slate-900 text-xl">{m.name}</span>
                            <span className="text-slate-700 text-lg font-medium">{m.dosage} {m.form}</span>
                         </div>
                         <div className="mt-2">
                            <p className="text-slate-800 font-medium text-lg leading-relaxed">{m.frequency} pendant {m.duration}</p>
                            {m.instructions && <p className="text-slate-600 italic mt-1 font-sans text-sm">Notes: {m.instructions}</p>}
                         </div>
                      </div>
                    ))}
                 </>
               )}

               {type === 'lab' && (
                  <div className="pl-4">
                    <ul className="space-y-3 font-medium text-lg">
                       {labTests.map(t => <li key={t} className="flex items-center"><span className="w-2 h-2 rounded-full bg-slate-800 mr-4"></span>{t}</li>)}
                       {otherLabTests && <li className="mt-6 pt-6 border-t border-slate-200 break-words whitespace-pre-wrap font-sans text-base">{otherLabTests}</li>}
                    </ul>
                  </div>
               )}

               {type === 'imagerie' && (
                  <div className="space-y-6">
                     <div className="p-4 bg-slate-50 border border-slate-200">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] font-sans mb-1 block">Modalité Demandée</span>
                        <p className="font-bold text-xl text-slate-900">{imagerieType || '...'}</p>
                     </div>
                     <div className="p-4 bg-slate-50 border border-slate-200">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] font-sans mb-1 block">Région Anatomique</span>
                        <p className="font-bold text-xl text-slate-900">{imagerieRegion || '...'}</p>
                     </div>
                     <div className="p-4 border border-slate-200">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] font-sans mb-2 block">Renseignements Cliniques</span>
                        <p className="text-lg whitespace-pre-wrap leading-relaxed">{imagerieIndication || '...'}</p>
                     </div>
                  </div>
               )}

               {type === 'nursing' && (
                  <div>
                     <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] font-sans block mb-4">Soins prescrits</span>
                     <p className="whitespace-pre-wrap text-lg leading-relaxed pl-4 border-l-2 border-slate-300">{nursingCare}</p>
                  </div>
               )}
            </div>

            <div className="mt-16 pt-8 border-t border-slate-800 flex justify-between items-end relative z-10">
               <div className="text-xs text-slate-500 font-sans space-y-1">
                  <p>Document généré informatiquement.</p>
                  <p>Valable 3 mois à compter de la date.</p>
               </div>
               <div className="text-center w-64">
                  <p className="text-slate-800 text-sm uppercase tracking-widest font-sans font-bold mb-12">Signature et Cachet</p>
                  <div className="w-full border-b border-slate-400"></div>
               </div>
            </div>
         </div>
      </div>
    </div>
    </div>
  );
}
