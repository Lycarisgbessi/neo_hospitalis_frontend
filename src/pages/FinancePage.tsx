import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { FileText, CheckCircle, XCircle, BarChart3, Receipt, Settings, Coins, CalendarDays } from 'lucide-react';

export default function FinancePage() {
  const { patients, purchaseOrders, maintenanceQuotes, updatePurchaseOrder, updateMaintenanceQuote, payments, serviceBudgets } = useApp();

  const handlePOStatus = (id: string, status: 'approved' | 'rejected') => {
    updatePurchaseOrder(id, { status });
  };

  const handleQuoteStatus = (id: string, status: 'approved' | 'rejected') => {
    updateMaintenanceQuote(id, { status });
  };

  const pendingPOs = purchaseOrders.filter(po => po.status === 'pending');
  const pendingQuotes = maintenanceQuotes.filter(mq => mq.status === 'pending');

  const totalRecettes = payments.reduce((acc, pay) => acc + pay.totalPaid, 0);
  
  const approvedPOs = purchaseOrders.filter(po => po.status === 'approved');
  const approvedQuotes = maintenanceQuotes.filter(q => q.status === 'approved');
  const approvedOutbound = approvedPOs.reduce((acc, po) => acc + po.amount, 0) + approvedQuotes.reduce((acc, q) => acc + q.amount, 0);

  // Budgets mensuels par service : configurables par le Super Admin (Paramètres).
  // Les consommations proviennent des bons de commande et devis approuvés.
  const budgetConsumptions = Object.entries(serviceBudgets).map(([srv, budget]) => {
     const consumed = approvedPOs.filter(po => po.service === srv).reduce((sum, po) => sum + po.amount, 0) +
                      approvedQuotes.filter(q => q.service === srv).reduce((sum, q) => sum + q.amount, 0);
     const base = budget || 1; // évite la division par zéro si budget à 0
     return { service: srv, budget, consumed, remaining: budget - consumed, percent: Math.round((consumed / base) * 100) };
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-GN', { style: 'currency', currency: 'GNF', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center">
            <Coins className="w-8 h-8 mr-3 text-indigo-600" />
            Comptabilité & Finances
          </h1>
          <p className="text-slate-500 mt-1">Trésorerie, historique des recettes, budgets par service et décaissements.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-green-200 shadow-sm ring-1 ring-green-100">
           <CardContent className="p-6">
              <div className="flex justify-between items-start">
                 <div>
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Total Recettes</p>
                    <h3 className="text-3xl font-black text-emerald-700 mt-2">{formatCurrency(totalRecettes)}</h3>
                    <p className="text-xs text-slate-400 mt-1">Depuis l'ouverture</p>
                 </div>
                 <div className="p-3 bg-green-100 rounded-xl">
                    <Receipt className="w-6 h-6 text-green-600" />
                 </div>
              </div>
           </CardContent>
        </Card>

        <Card className="border-red-200 shadow-sm ring-1 ring-red-100">
           <CardContent className="p-6">
              <div className="flex justify-between items-start">
                 <div>
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Dépenses (Validées)</p>
                    <h3 className="text-3xl font-black text-rose-700 mt-2">{formatCurrency(approvedOutbound)}</h3>
                    <p className="text-xs text-slate-400 mt-1">Bons de cde et Devis payés</p>
                 </div>
                 <div className="p-3 bg-red-100 rounded-xl">
                    <BarChart3 className="w-6 h-6 text-red-600" />
                 </div>
              </div>
           </CardContent>
        </Card>

        <Card className="border-indigo-200 shadow-sm bg-indigo-50/50 ring-1 ring-indigo-100">
           <CardContent className="p-6">
              <div className="flex justify-between items-start">
                 <div>
                    <p className="text-sm font-semibold text-indigo-800 uppercase tracking-widest">Bilan Net (Trésorerie)</p>
                    <h3 className="text-3xl font-black text-indigo-900 mt-2">{formatCurrency(totalRecettes - approvedOutbound)}</h3>
                 </div>
              </div>
           </CardContent>
        </Card>
      </div>
      
      <div className="grid lg:grid-cols-3 gap-8">
         <Card className="lg:col-span-2 shadow-sm border-slate-200">
           <CardHeader className="bg-slate-50/50 border-b border-slate-100">
             <CardTitle className="text-lg">Registre des Entrées (Recettes Caisse)</CardTitle>
             <CardDescription>Historique détaillé de tous les paiements effectués à la caisse.</CardDescription>
           </CardHeader>
           <CardContent className="p-0">
             <div className="max-h-[500px] overflow-y-auto">
               <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 border-b border-slate-100">
                     <tr>
                        <th className="px-4 py-3 font-semibold">Date & Réf</th>
                        <th className="px-4 py-3 font-semibold">Patient</th>
                        <th className="px-4 py-3 font-semibold">Moyen & Ass.</th>
                        <th className="px-4 py-3 font-semibold text-right">Montant Réel (Net)</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {[...payments].reverse().map(pay => {
                        const pat = patients.find(p => p.id === pay.patientId);
                        return (
                           <tr key={pay.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3">
                                 <div className="font-medium text-slate-900">{new Date(pay.date).toLocaleDateString()}</div>
                                 <div className="text-xs text-slate-500 font-mono">{pay.id}</div>
                              </td>
                              <td className="px-4 py-3">
                                 <div className="font-medium text-slate-700">{pat?.name || 'Inconnu'}</div>
                                 <div className="text-[10px] text-slate-400 line-clamp-1 max-w-[150px]">{pay.items.map(i => i.name).join(', ')}</div>
                              </td>
                              <td className="px-4 py-3">
                                 <Badge variant="outline" className="uppercase text-[10px] mb-1 block w-max">{pay.paymentMethod.replace('_', ' ')}</Badge>
                                 {pay.insuranceProvider && <span className="text-xs text-rose-600 block">{pay.insuranceProvider} ({pay.insuranceCoveragePercentage}%)</span>}
                              </td>
                              <td className="px-4 py-3 text-right">
                                 <span className="font-bold text-emerald-700">{formatCurrency(pay.totalPaid)}</span>
                              </td>
                           </tr>
                        )
                     })}
                     {payments.length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-500">Aucun encaissement pour le moment.</td></tr>
                     )}
                  </tbody>
               </table>
             </div>
           </CardContent>
         </Card>

         <Card className="shadow-sm border-slate-200 h-max">
           <CardHeader className="bg-slate-50/50 border-b border-slate-100">
             <CardTitle className="text-lg">Consommation des Budgets</CardTitle>
             <CardDescription>Mois en cours: {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</CardDescription>
           </CardHeader>
           <CardContent className="p-4 space-y-6">
              {budgetConsumptions.map(bc => (
                 <div key={bc.service}>
                    <div className="flex justify-between items-center mb-1">
                       <span className="text-sm font-semibold capitalize text-slate-700">{bc.service}</span>
                       <span className="text-xs font-bold text-slate-900">{formatCurrency(bc.consumed)} / {formatCurrency(bc.budget)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                       <div className={`h-2 rounded-full ${bc.percent > 90 ? 'bg-red-500' : bc.percent > 70 ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(bc.percent, 100)}%` }}></div>
                    </div>
                    <p className="text-[10px] text-slate-500 text-right mt-1">{bc.percent}% consommé</p>
                 </div>
              ))}
           </CardContent>
         </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg text-slate-800">Bons de Commande en attente ({pendingPOs.length})</CardTitle>
            <CardDescription>Achat de réactifs et médicaments</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
             <ul className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
               {pendingPOs.map(po => (
                 <li key={po.id} className="p-5 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                       <div>
                          <Badge variant="outline" className="mb-2 capitalize border-slate-300 text-slate-600">{po.service}</Badge>
                          <h4 className="font-semibold text-slate-900">{po.id}</h4>
                          <p className="text-xs text-slate-500 mt-1">Par {po.createdBy} le {new Date(po.date).toLocaleDateString()}</p>
                       </div>
                       <div className="text-right">
                          <span className="font-bold text-lg text-slate-800">{formatCurrency(po.amount)}</span>
                       </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-md p-3 text-sm text-slate-600 mb-4 whitespace-pre-wrap font-mono">
                       {po.items}
                    </div>
                    <div className="flex space-x-3 justify-end border-t border-slate-100 pt-3">
                       <Button variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => handlePOStatus(po.id, 'rejected')}>
                          <XCircle className="w-4 h-4 mr-2" /> Rejeter
                       </Button>
                       <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handlePOStatus(po.id, 'approved')}>
                          <CheckCircle className="w-4 h-4 mr-2" /> Valider l'achat
                       </Button>
                    </div>
                 </li>
               ))}
               {pendingPOs.length === 0 && (
                 <li className="p-8 text-center text-slate-500 italic">Aucun bon de commande en attente.</li>
               )}
             </ul>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg text-slate-800">Devis de Maintenance ({pendingQuotes.length})</CardTitle>
            <CardDescription>Maintenance des automates et équipements</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
             <ul className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
               {pendingQuotes.map(mq => (
                 <li key={mq.id} className="p-5 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                       <div>
                          <Badge variant="outline" className="mb-2 capitalize border-slate-300 text-slate-600">{mq.service}</Badge>
                          <h4 className="font-semibold text-slate-900">{mq.equipment}</h4>
                          <p className="text-xs text-slate-500 mt-1">Par {mq.createdBy} le {new Date(mq.date).toLocaleDateString()}</p>
                       </div>
                       <div className="text-right">
                          <span className="font-bold text-lg text-slate-800">{formatCurrency(mq.amount)}</span>
                       </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-md p-3 text-sm text-slate-600 mb-4 whitespace-pre-wrap font-mono">
                       {mq.issue}
                    </div>
                    <div className="flex space-x-3 justify-end border-t border-slate-100 pt-3">
                       <Button variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => handleQuoteStatus(mq.id, 'rejected')}>
                          <XCircle className="w-4 h-4 mr-2" /> Rejeter
                       </Button>
                       <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => handleQuoteStatus(mq.id, 'approved')}>
                          <CheckCircle className="w-4 h-4 mr-2" /> Valider le décaissement
                       </Button>
                    </div>
                 </li>
               ))}
               {pendingQuotes.length === 0 && (
                 <li className="p-8 text-center text-slate-500 italic">Aucun devis de maintenance en attente.</li>
               )}
             </ul>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
