import React, { useState, useEffect } from 'react';
import { useApp, Payment, PRICING_CATALOG, INSURANCE_CATALOG, generateId } from '../context/AppContext';
import { useAI } from '../context/AIContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';
import { CreditCard, CheckCircle, Clock, Banknote, Receipt, AlertCircle, RefreshCw, User, FileText } from 'lucide-react';

export default function CashierPage() {
  const { patients, updatePatient, orders, updateOrder, payments, addPayment, currentUser, hospitalProfile } = useApp();
  const { registerPage, unregisterPage } = useAI();

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  
  // Payment Form State
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'orange_money' | 'mobile_money' | 'visa'>('cash');
  const [insuranceProvider, setInsuranceProvider] = useState<string>(''); // empty = no insurance
  const [insuranceCoverage, setInsuranceCoverage] = useState<number>(0);
  
  const [showReceipt, setShowReceipt] = useState<string | null>(null);

  // ── Enregistrement du contexte IA ────────────────────────────────────────
  useEffect(() => {
    registerPage(
      'Caisse Centrale',
      {
        patientId: "ID du patient à sélectionner (ex: P001)",
        patientName: "Nom du patient à rechercher",
        paymentMethod: "cash, orange_money, mobile_money ou visa",
        insuranceProvider: "Nom de l'assurance (NSIA, SAHAM, UGAR, SOGAM, SUNU) ou vide"
      },
      (action) => {
        if (action.type === 'fill_form' && action.payload) {
          const payload = action.payload as Record<string, unknown>;
          if (typeof payload.patientId === 'string' && payload.patientId) {
            setSelectedPatientId(payload.patientId);
          } else if (typeof payload.patientName === 'string' && payload.patientName) {
            const found = patients.find(p =>
              p.name.toLowerCase().includes(payload.patientName as string)
            );
            if (found) setSelectedPatientId(found.id);
          }
          if (typeof payload.paymentMethod === 'string') setPaymentMethod(payload.paymentMethod as Payment['paymentMethod']);
          if (typeof payload.insuranceProvider === 'string' && payload.insuranceProvider) {
            const provider = payload.insuranceProvider;
            setInsuranceProvider(provider);
            setInsuranceCoverage(INSURANCE_CATALOG[provider] || 0);
          }
        }
      }
    );
    return () => unregisterPage();
  }, [registerPage, unregisterPage, patients]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-GN', { style: 'currency', currency: 'GNF', maximumFractionDigits: 0 }).format(amount);
  };

  // derived state for selected patient
  const selectedPatient = patients.find(p => p.id === selectedPatientId);
  const pendingItemsForPatient: { id: string; type: 'consultation' | 'order', name: string, fee: number, details?: string }[] = [];

  if (selectedPatient) {
    // Pas de frais de consultation pour les accès directs aux examens (audit A3) ;
    // les ordres à 0 FG (tarif catalogue pharmacie) restent visibles et validables (audit A2).
    if (!selectedPatient.consultationFeePaid && selectedPatient.admissionType !== 'exam_direct') {
      const consultationFee = PRICING_CATALOG[selectedPatient.targetService] || PRICING_CATALOG.general || 15000;
      pendingItemsForPatient.push({ id: `CONS-${selectedPatient.id}`, type: 'consultation', name: 'Frais de Consultation', fee: consultationFee, details: selectedPatient.targetService });
    }
    const patOrders = orders.filter(o => o.patientId === selectedPatient.id && o.status === 'pending');
    patOrders.forEach(o => {
      pendingItemsForPatient.push({ id: o.id, type: 'order', name: o.fee > 0 ? `Acte/Prescription (${o.type})` : `Acte/Prescription (${o.type}) — offert`, fee: o.fee, details: o.details });
    });
  }

  const toggleItemSelection = (id: string) => {
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const getSubtotal = () => {
    return pendingItemsForPatient.filter(i => selectedItemIds.has(i.id)).reduce((acc, i) => acc + i.fee, 0);
  };

  // Répartition GNF sans centimes (audit C4)
  const insuranceDeduction = Math.round((getSubtotal() * (insuranceProvider ? insuranceCoverage : 0)) / 100);
  const netToPay = Math.round(getSubtotal() - insuranceDeduction);

  const handleProcessPayment = () => {
    if (!selectedPatient || selectedItemIds.size === 0) return;

    const itemsToPay = pendingItemsForPatient.filter(i => selectedItemIds.has(i.id));
    const paysConsultation = itemsToPay.some(i => i.type === 'consultation');

    // Update statuses
    itemsToPay.forEach(item => {
      if (item.type === 'consultation') {
        updatePatient(selectedPatient.id, { consultationFeePaid: true, status: 'waiting_consultation' });
      } else {
        updateOrder(item.id, { status: 'paid' });
      }
    });

    // Accès direct examens : une fois tout réglé, le patient passe en parcours
    // en cours (waiting_consultation) — il attend son examen au service (audit A3).
    if (!paysConsultation && selectedPatient.admissionType === 'exam_direct' && selectedPatient.status === 'waiting_payment') {
      const remainingPending = orders.some(o =>
        o.patientId === selectedPatient.id && o.status === 'pending' && !selectedItemIds.has(o.id)
      );
      if (!remainingPending) {
        updatePatient(selectedPatient.id, { status: 'waiting_consultation' });
      }
    }

    const paymentId = generateId('PAY');
    
    addPayment({
      id: paymentId,
      patientId: selectedPatient.id,
      items: itemsToPay.map(i => ({ type: i.type, id: i.id, name: i.name, amount: i.fee })),
      subtotal: getSubtotal(),
      insuranceProvider: insuranceProvider || undefined,
      insuranceCoveragePercentage: insuranceProvider ? insuranceCoverage : 0,
      insuranceDeduction: insuranceDeduction,
      totalPaid: netToPay,
      paymentMethod,
      date: new Date().toISOString(),
      cashierId: currentUser?.name || 'Caissier'
    });

    setSelectedItemIds(new Set());
    setPaymentMethod('cash');
    setInsuranceProvider('');
    setInsuranceCoverage(0);
    setSelectedPatientId(null);
    setShowReceipt(paymentId);
  };

  // List of patients with pending items (consultation due hors accès direct ;
  // tous les ordres en attente, y compris à 0 FG — audit A2/A3)
  const patientsWithPending = patients.filter(p => {
    const hasCons = !p.consultationFeePaid && p.admissionType !== 'exam_direct';
    const hasOrders = orders.some(o => o.patientId === p.id && o.status === 'pending');
    return hasCons || hasOrders;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center">
             <Banknote className="w-8 h-8 mr-3 text-emerald-600" />
             Caisse Centrale
          </h1>
          <p className="text-slate-500 mt-1">Encaissements, gestion des assurances et reçus.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        
        {/* Left Column: Patients Queue & History */}
        <div className="lg:col-span-5 space-y-6">
           <Card className="border-slate-200 shadow-sm ring-1 ring-slate-200">
             <CardHeader className="bg-slate-50/80 border-b border-slate-100 pb-4">
               <CardTitle className="text-lg flex items-center text-slate-800">
                 <AlertCircle className="w-5 h-5 mr-2 text-orange-500" /> Facturations en Attente
               </CardTitle>
             </CardHeader>
             <CardContent className="p-0">
                <div className="max-h-[400px] overflow-y-auto">
                   <ul className="divide-y divide-slate-100">
                     {patientsWithPending.map(p => (
                       <li
                         key={p.id}
                         className={`p-4 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset ${selectedPatientId === p.id ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-slate-50 border-l-4 border-transparent'}`}
                         onClick={() => setSelectedPatientId(p.id)}
                         onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPatientId(p.id); } }}
                         tabIndex={0}
                         role="button"
                         aria-label={`Encaisser ${p.name}`}
                       >
                          <div className="flex justify-between items-center">
                             <div>
                                <h4 className="font-semibold text-slate-900">{p.name}</h4>
                                <p className="text-xs text-slate-500">{p.id} • {orders.filter(o => o.patientId === p.id && o.status === 'pending').length + (!p.consultationFeePaid && p.admissionType !== 'exam_direct' ? 1 : 0)} act. en attente</p>
                             </div>
                             <CheckCircle className={`w-5 h-5 ${selectedPatientId === p.id ? 'text-blue-600' : 'text-slate-300'}`} />
                          </div>
                       </li>
                     ))}
                     {patientsWithPending.length === 0 && (
                        <li className="p-8 text-center text-slate-500">Aucun patient en attente de paiement.</li>
                     )}
                   </ul>
                </div>
             </CardContent>
           </Card>

           <Card className="border-slate-200 shadow-sm">
             <CardHeader className="bg-slate-50/80 border-b border-slate-100 pb-4">
               <CardTitle className="text-lg flex items-center text-slate-800">
                 <RefreshCw className="w-5 h-5 mr-2 text-slate-400" /> Historique Récent
               </CardTitle>
             </CardHeader>
             <CardContent className="p-0">
                <div className="max-h-[300px] overflow-y-auto">
                   <ul className="divide-y divide-slate-100">
                      {[...payments].reverse().slice(0, 10).map(pay => (
                         <li key={pay.id} className="p-4 hover:bg-slate-50 flex justify-between items-center group">
                            <div>
                               <p className="font-semibold text-slate-900 text-sm">{patients.find(p => p.id === pay.patientId)?.name || 'Anonyme'}</p>
                               <p className="text-xs text-slate-500">{new Date(pay.date).toLocaleString()} • {pay.paymentMethod}</p>
                            </div>
                            <div className="text-right">
                               <p className="font-bold text-emerald-700 text-sm">{formatCurrency(pay.totalPaid)}</p>
                               <Button variant="ghost" size="sm" className="h-6 text-xs mt-1 inline-flex md:hidden md:group-hover:inline-flex" onClick={() => setShowReceipt(pay.id)}>Reçu</Button>
                            </div>
                         </li>
                      ))}
                      {payments.length === 0 && (
                         <li className="p-6 text-center text-sm text-slate-500">Aucun paiement récent.</li>
                      )}
                   </ul>
                </div>
             </CardContent>
           </Card>
        </div>

        {/* Right Column: Payment Form */}
        <div className="lg:col-span-7">
           {selectedPatient ? (
              <Card className="border-0 shadow-md ring-1 ring-emerald-200">
                 <CardHeader className="bg-emerald-600 rounded-t-xl text-white">
                    <CardTitle className="text-xl flex items-center">
                       <CreditCard className="w-5 h-5 mr-3 opacity-80" /> Encaissement: {selectedPatient.name}
                    </CardTitle>
                    <CardDescription className="text-emerald-100">Cochez les éléments à régler et appliquez la couverture assurance.</CardDescription>
                 </CardHeader>
                 <CardContent className="p-6 space-y-6 bg-white rounded-b-xl">
                    
                    {/* Items List */}
                    <div>
                       <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Éléments à régler</h3>
                       <div className="space-y-2">
                          {pendingItemsForPatient.map((item, idx) => (
                             <label key={item.id + idx} className={`flex items-start justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedItemIds.has(item.id) ? 'bg-emerald-50 border-emerald-200' : 'border-slate-200 hover:bg-slate-50'}`}>
                                <div className="flex items-start">
                                   <input 
                                     type="checkbox" 
                                     className="mt-1 mr-3 w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded" 
                                     checked={selectedItemIds.has(item.id)}
                                     onChange={() => toggleItemSelection(item.id)}
                                   />
                                   <div>
                                      <p className={`font-semibold ${selectedItemIds.has(item.id) ? 'text-emerald-900' : 'text-slate-800'}`}>{item.name}</p>
                                      <p className="text-xs text-slate-500 max-w-sm line-clamp-1">{item.details}</p>
                                   </div>
                                </div>
                                <span className={`font-bold ${selectedItemIds.has(item.id) ? 'text-emerald-700' : 'text-slate-600'}`}>{formatCurrency(item.fee)}</span>
                             </label>
                          ))}
                          {pendingItemsForPatient.length === 0 && (
                             <p className="text-slate-500 text-sm italic">Aucun élément en attente.</p>
                          )}
                       </div>
                    </div>

                    <div className="border-t border-slate-100 pt-6 grid md:grid-cols-2 gap-6">
                       {/* Options */}
                       <div className="space-y-4">
                          <div>
                             <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Prise en charge (Assurance)</label>
                             <select className="w-full h-9 rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500 mb-2" value={insuranceProvider} onChange={e => {
                                const provider = e.target.value;
                                setInsuranceProvider(provider);
                                setInsuranceCoverage(INSURANCE_CATALOG[provider] || 0);
                             }}>
                                <option value="">Aucune (Paiement intégral)</option>
                                {Object.keys(INSURANCE_CATALOG).map(provider => (
                                  <option key={provider} value={provider}>{provider} (max {INSURANCE_CATALOG[provider]}%)</option>
                                ))}
                             </select>
                             {insuranceProvider && (
                                <div className="flex items-center space-x-2">
                                   <span className="text-sm font-medium text-slate-600">Taux couverture:</span>
                                   <Input type="number" min="0" max={INSURANCE_CATALOG[insuranceProvider] || 100} value={insuranceCoverage} onChange={e => {
                                      let val = parseInt(e.target.value) || 0;
                                      const max = INSURANCE_CATALOG[insuranceProvider] || 0;
                                      if (val > max) val = max;
                                      setInsuranceCoverage(val);
                                   }} className="w-20 h-8" />
                                   <span className="text-sm font-medium text-slate-600">%</span>
                                </div>
                             )}
                          </div>
                          <div>
                             <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Moyen de paiement</label>
                             <select className="w-full h-9 rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as Payment['paymentMethod'])}>
                                <option value="cash">Espèces</option>
                                <option value="orange_money">Orange Money</option>
                                <option value="mobile_money">MTN Mobile Money</option>
                                <option value="visa">Carte Bancaire (Visa/MC)</option>
                             </select>
                          </div>
                       </div>

                       {/* Summary */}
                       <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                          <div className="space-y-2 mb-4">
                             <div className="flex justify-between text-sm">
                               <span className="text-slate-500">Sous-total</span>
                               <span className="font-semibold text-slate-800">{formatCurrency(getSubtotal())}</span>
                             </div>
                             {insuranceProvider && (
                               <div className="flex justify-between text-sm text-red-600">
                                 <span>Prise en charge ({insuranceCoverage}%)</span>
                                 <span>- {formatCurrency(insuranceDeduction)}</span>
                               </div>
                             )}
                          </div>
                          <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                             <span className="font-bold text-slate-800">Net à Payer</span>
                             <span className="text-2xl font-black text-emerald-600">{formatCurrency(netToPay)}</span>
                          </div>
                       </div>
                    </div>

                    <Button size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-md text-lg" disabled={selectedItemIds.size === 0} onClick={handleProcessPayment}>
                       <CheckCircle className="w-5 h-5 mr-2" /> Valider le règlement
                    </Button>

                 </CardContent>
              </Card>
           ) : (
              <div className="h-full flex flex-col justify-center items-center p-12 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                 <User className="w-16 h-16 text-slate-300 mb-4" />
                 <h3 className="text-xl font-bold text-slate-700">Aucun patient sélectionné</h3>
                 <p className="text-slate-500 mt-2 max-w-sm">Sélectionnez un patient dans la liste de gauche pour procéder à l'encaissement de ses factures.</p>
              </div>
           )}
        </div>
      </div>

      {/* Receipt Modal */}
      <Dialog size="lg" open={showReceipt !== null} onOpenChange={() => setShowReceipt(null)}>
         {(() => {
            const pay = payments.find(p => p.id === showReceipt);
            if (!pay) return null;
            const pat = patients.find(p => p.id === pay.patientId);
            return (
              <div className="bg-white text-slate-900 overflow-hidden print-area">
                <DialogHeader className="bg-slate-100 border-b border-slate-200 p-6">
                  <DialogTitle className="flex justify-between items-start">
                     <div>
                        <span className="text-2xl font-black text-slate-800 tracking-tight">{hospitalProfile.name}</span>
                        <p className="text-sm font-medium text-slate-500 mt-1">{hospitalProfile.city} • Reçu de Paiement • {pay.id}</p>
                     </div>
                     <Receipt className="w-10 h-10 text-slate-300 no-print" />
                  </DialogTitle>
                </DialogHeader>
                <div className="p-6 space-y-6 font-mono text-sm">
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <p className="text-slate-500">Date</p>
                         <p className="font-bold">{new Date(pay.date).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                         <p className="text-slate-500">Patient</p>
                         <p className="font-bold">{pat?.name} ({pat?.id})</p>
                      </div>
                   </div>
                   
                   <div className="border-t border-b border-slate-200 py-4 space-y-2">
                     {pay.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                           <span className="max-w-[70%] line-clamp-1">{item.name}</span>
                           <span className="font-semibold">{formatCurrency(item.amount)}</span>
                        </div>
                     ))}
                   </div>

                   <div className="space-y-2">
                     <div className="flex justify-between items-center text-slate-500">
                        <span>Sous-total</span>
                        <span>{formatCurrency(pay.subtotal)}</span>
                     </div>
                     {pay.insuranceProvider && (
                        <div className="flex justify-between items-center">
                           <span className="text-red-500">Assurance ({pay.insuranceProvider} - {pay.insuranceCoveragePercentage}%)</span>
                           <span className="text-red-500">- {formatCurrency(pay.insuranceDeduction)}</span>
                        </div>
                     )}
                     <div className="flex justify-between items-center pt-2 text-lg">
                        <span className="font-bold uppercase">Total Payé</span>
                        <span className="font-black text-slate-900">{formatCurrency(pay.totalPaid)}</span>
                     </div>
                     <div className="flex justify-between items-center text-xs text-slate-500 pt-2">
                        <span>Mode de paiement</span>
                        <span className="uppercase">{pay.paymentMethod.replace('_', ' ')}</span>
                     </div>
                   </div>
                </div>
                <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 flex justify-between">
                   <span className="text-xs text-slate-400 self-center">Caissier: {pay.cashierId}</span>
                   <div className="space-x-2">
                     <Button variant="outline" onClick={() => setShowReceipt(null)}>Fermer</Button>
                     <Button className="bg-slate-900 hover:bg-slate-800" onClick={() => window.print()}>
                        <FileText className="w-4 h-4 mr-2" />
                        Imprimer
                     </Button>
                   </div>
                </DialogFooter>
              </div>
            )
         })()}
      </Dialog>
    </div>
  );
}
