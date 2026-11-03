import React, { useState, useEffect } from 'react';
import { useApp, generateId } from '../context/AppContext';
import { useAI } from '../context/AIContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Syringe, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';

export default function NursePage() {
  const { patients, orders, completeOrder, updatePatient, currentUser } = useApp();
  const { registerPage, unregisterPage } = useAI();
  
  const nursingOrders = orders.filter(o => o.type === 'nursing');
  const paidOrders = nursingOrders.filter(o => o.status === 'paid');
  const completedOrders = nursingOrders.filter(o => o.status === 'completed');
  const pendingPaymentOrders = nursingOrders.filter(o => o.status === 'pending');

  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [report, setReport] = useState('');

  // ── Enregistrement du contexte IA ────────────────────────────────────────
  useEffect(() => {
    registerPage(
      'Soins Infirmiers',
      {
        action: "'validate' pour valider le 1er soin en attente",
        orderId: "Numéro du bon de soins à traiter",
        report: "Compte rendu du soin infirmier réalisé"
      },
      (action) => {
        if (action.type === 'fill_form' && action.payload) {
          const payload = action.payload as Record<string, unknown>;
          if (typeof payload.report === 'string' && payload.report) setReport(payload.report);
          if (typeof payload.orderId === 'string' && payload.orderId) {
            const ord = paidOrders.find(o => o.id === payload.orderId);
            if (ord) setSelectedOrder(ord.id);
          } else if (payload.action === 'validate' && paidOrders.length > 0) {
            setSelectedOrder(paidOrders[0].id);
          }
        }
      }
    );
    return () => unregisterPage();
  }, [registerPage, unregisterPage, paidOrders]);
  
  const handleComplete = () => {
    if (selectedOrder) {
      const order = orders.find(o => o.id === selectedOrder);
      completeOrder(selectedOrder);

      // Le compte-rendu du soin est archivé dans le dossier médical du patient
      // (visible par le médecin dans l'onglet Historique).
      const patient = patients.find(p => p.id === order?.patientId);
      if (patient && order) {
        const newRecord = {
          id: generateId('SOIN'),
          date: new Date().toISOString(),
          type: 'soin_infirmier',
          summary: order.details,
          details: {
            compteRendu: report,
            prescripteur: order.prescribedBy,
            realisePar: currentUser?.name || 'Infirmier(ère)',
          }
        };
        updatePatient(patient.id, {
          medicalRecords: [...(patient.medicalRecords || []), newRecord]
        });
      }

      setSelectedOrder(null);
      setReport('');
    }
  };

  const getPatientName = (patientId: string) => patients.find(p => p.id === patientId)?.name || 'Inconnu';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center">
            <Syringe className="w-8 h-8 mr-3 text-pink-600" />
            Soins Infirmiers
          </h1>
          <p className="text-slate-500 mt-1">Exécution des soins prescrits par les médecins.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-md ring-1 ring-slate-200">
            <CardHeader className="bg-pink-600 rounded-t-xl text-white">
              <CardTitle className="text-xl">Actes à réaliser</CardTitle>
              <CardDescription className="text-pink-100">Patients ayant réglé leurs frais, en attente de soins.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {[...paidOrders].reverse().map(ord => (
                  <div key={ord.id} className="p-6 bg-white hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center space-x-3 mb-1">
                          <h3 className="font-bold text-lg text-slate-900">{getPatientName(ord.patientId)}</h3>
                          <Badge variant="success">Attente Soin</Badge>
                        </div>
                        <p className="text-sm text-slate-500">N° {ord.id} • Prescrit par {ord.prescribedBy}</p>
                      </div>
                      <Button size="lg" onClick={() => setSelectedOrder(ord.id)} className="bg-pink-600 hover:bg-pink-700 shadow-sm">
                        Valider l'acte
                      </Button>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-slate-700 font-medium font-serif text-sm leading-relaxed whitespace-pre-line">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Prescription :</span>
                      {ord.details}
                    </div>
                  </div>
                ))}
                {paidOrders.length === 0 && (
                  <div className="p-12 text-center flex flex-col items-center">
                    <CheckCircle className="w-12 h-12 text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium text-lg">Aucun soin en attente.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pending Payment Orders Insight */}
          {pendingPaymentOrders.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start">
               <AlertTriangle className="w-5 h-5 text-orange-500 mr-3 shrink-0 mt-0.5" />
               <div>
                 <h4 className="font-semibold text-orange-900">Actes en attente de paiement ({pendingPaymentOrders.length})</h4>
                 <p className="text-sm text-orange-800/80 mt-1">Ces soins ont été prescrits mais le patient n'est pas encore passé à la caisse.</p>
               </div>
            </div>
          )}
        </div>
        
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-lg flex items-center">
                 <Clock className="w-5 h-5 mr-2 text-slate-500"/>
                 Soins Réalisés Récemment
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <ul className="divide-y divide-slate-100">
                {[...completedOrders].reverse().slice(0, 5).map(o => (
                  <li key={o.id} className="p-4 hover:bg-slate-50">
                    <div className="flex items-start">
                      <Syringe className="w-4 h-4 text-slate-400 mt-1 mr-3 shrink-0" />
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{getPatientName(o.patientId)}</p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{o.details}</p>
                      </div>
                    </div>
                  </li>
                ))}
                {completedOrders.length === 0 && (
                   <li className="p-4 text-center text-sm text-slate-500">Aucun historique récent.</li>
                )}
               </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog size="xl" open={selectedOrder !== null} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogHeader>
          <DialogTitle>Validation des Soins Infirmiers</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-slate-600">Confirmez que le soin a été administré. Vous pouvez ajouter un compte rendu d'observation.</p>
          <div>
            <textarea 
              value={report}
              onChange={(e) => setReport(e.target.value)}
              className="w-full min-h-[150px] font-serif border border-slate-200 rounded-md p-4 text-sm focus:outline-none focus:ring-1 focus:ring-pink-500 shadow-inner" 
              placeholder="Ex: Soin bien supporté par le patient. Pouls pris à la fin du soin..."
            ></textarea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSelectedOrder(null)}>Annuler</Button>
          <Button onClick={handleComplete} className="bg-pink-600 hover:bg-pink-700">
            Valider et Clôturer
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
