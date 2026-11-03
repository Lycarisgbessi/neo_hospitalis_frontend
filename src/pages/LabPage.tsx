import React, { useState, useEffect } from 'react';
import { useApp, Order, LabResultRow, generateId } from '../context/AppContext';
import { useAI } from '../context/AIContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { TestTube, Search, FlaskConical, AlertTriangle, CheckCircle, FileText, Wrench, PackagePlus } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';
import { useToast } from '../components/Toast';

export default function LabPage() {
  const { patients, orders, updateOrder, completeOrder, updatePatient, purchaseOrders, addPurchaseOrder, maintenanceQuotes, addMaintenanceQuote, currentUser } = useApp();
  const { registerPage, unregisterPage } = useAI();
  const toast = useToast();
  
  const labOrders = orders.filter(o => o.type === 'lab');
  const paidOrders = labOrders.filter(o => o.status === 'paid'); 
  const completedOrders = labOrders.filter(o => o.status === 'completed');
  const pendingPaymentOrders = labOrders.filter(o => o.status === 'pending');

  const myPOs = purchaseOrders.filter(po => po.service === 'laboratoire');
  const myQuotes = maintenanceQuotes.filter(mq => mq.service === 'laboratoire');

  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [showPOModal, setShowPOModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  
  // Structured Lab Results State (type partagé avec le dossier patient — voir AppContext)
  const [labResultRows, setLabResultRows] = useState<LabResultRow[]>([{ param: '', result: '', unit: '', reference: '', flag: 'normal' }]);
  const [labGeneralNotes, setLabGeneralNotes] = useState('');
  
  const [poItems, setPoItems] = useState('');
  const [poAmount, setPoAmount] = useState('');
  const [quoteEquip, setQuoteEquip] = useState('');
  const [quoteIssue, setQuoteIssue] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');

  // ── Enregistrement du contexte IA ────────────────────────────────────────
  useEffect(() => {
    registerPage(
      'Laboratoire de Biologie',
      {
        action: "'process' pour ouvrir le traitement du 1er bon en attente, 'maintenance' pour ouvrir le formulaire de devis",
        orderId: "Numéro du bon d'analyse à traiter (ex: ORD-002)",
        labNotes: "Conclusion générale du biologiste",
        quoteEquip: "Nom de l'équipement à maintenir",
        quoteIssue: "Description de la panne"
      },
      (action) => {
        if (action.type === 'fill_form' && action.payload) {
          const payload = action.payload as Record<string, unknown>;
          if (payload.action === 'maintenance') setShowQuoteModal(true);
          if (typeof payload.orderId === 'string' && payload.orderId) {
            const ord = paidOrders.find(o => o.id === payload.orderId);
            if (ord) handleSelectOrder(ord);
          } else if (payload.action === 'process' && paidOrders.length > 0) {
            handleSelectOrder(paidOrders[0]);
          }
          if (typeof payload.labNotes === 'string' && payload.labNotes) setLabGeneralNotes(payload.labNotes);
          if (typeof payload.quoteEquip === 'string' && payload.quoteEquip) setQuoteEquip(payload.quoteEquip);
          if (typeof payload.quoteIssue === 'string' && payload.quoteIssue) setQuoteIssue(payload.quoteIssue);
        }
      }
    );
    return () => unregisterPage();
  }, [registerPage, unregisterPage, paidOrders]);

  const addLabRow = () => setLabResultRows([...labResultRows, { param: '', result: '', unit: '', reference: '', flag: 'normal' }]);
  const updateLabRow = (index: number, field: keyof LabResultRow, value: string) => {
    const newRows = [...labResultRows];
    newRows[index][field] = value;
    setLabResultRows(newRows);
  };
  const removeLabRow = (index: number) => {
    const newRows = labResultRows.filter((_, i) => i !== index);
    setLabResultRows(newRows.length ? newRows : [{ param: '', result: '', unit: '', reference: '', flag: 'normal' }]);
  };

  const handleSelectOrder = (ord: Order) => {
    setSelectedOrder(ord.id);
    if (ord.details.includes('Analyses demandées :')) {
      const tests = ord.details.split('\n')
        .filter((line: string) => line.startsWith('- '))
        .map((line: string) => line.substring(2).replace(/^Autre:\s*/, ''));
      if (tests.length > 0) {
        setLabResultRows(tests.map((param: string) => ({ param, result: '', unit: '', reference: '', flag: 'normal' })));
      } else {
        setLabResultRows([{ param: '', result: '', unit: '', reference: '', flag: 'normal' }]);
      }
    } else {
      setLabResultRows([{ param: '', result: '', unit: '', reference: '', flag: 'normal' }]);
    }
  };

  const handleComplete = () => {
    if (selectedOrder) {
      // Audit R3 : les lignes sans paramètre ne doivent pas être signées
      const validRows = labResultRows.filter(r => r.param.trim() !== '');
      if (validRows.length === 0) {
        toast.error('Renseignez au moins un paramètre de résultat avant de signer.');
        return;
      }
      const order = orders.find(o => o.id === selectedOrder);
      if (order) {
        completeOrder(selectedOrder);

        // Add to medical records so doctor can see it in real-time
        const patient = patients.find(p => p.id === order.patientId);
        if (patient) {
          // Audit X3 : résumé complet (tous les examens), sans tiret résiduel
          const tests = order.details.split('\n').slice(1).map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean);
          const newRecord = {
            id: generateId('LAB-RES'),
            date: new Date().toISOString(),
            type: 'lab_result',
            summary: `Résultats d'analyses : ${tests.join(', ') || 'Bilan biologique'}`,
            details: {
              results: validRows,
              notes: labGeneralNotes
            }
          };
          updatePatient(patient.id, {
            medicalRecords: [...(patient.medicalRecords || []), newRecord]
          });
        }
        
        toast.success('Résultats signés et transmis au médecin — réactifs décrémentés du stock Laboratoire.');
      }
      setSelectedOrder(null);
      setLabResultRows([{ param: '', result: '', unit: '', reference: '', flag: 'normal' }]);
      setLabGeneralNotes('');
    }
  };

  const handleCreatePO = () => {
    if (!poItems) return;
    addPurchaseOrder({
      id: generateId(`PO-${new Date().getFullYear()}`),
      service: 'laboratoire',
      items: poItems,
      amount: Math.max(0, parseInt(poAmount) || 0),
      status: 'pending',
      date: new Date().toISOString(),
      createdBy: currentUser?.name || 'Technicien Labo'
    });
    setShowPOModal(false);
    setPoItems(''); setPoAmount('');
  };

  const handleCreateQuote = () => {
    if (!quoteEquip || !quoteIssue) return;
    addMaintenanceQuote({
      id: generateId(`MQ-${new Date().getFullYear()}`),
      service: 'laboratoire',
      equipment: quoteEquip,
      issue: quoteIssue,
      amount: Math.max(0, parseInt(quoteAmount) || 0),
      status: 'pending',
      date: new Date().toISOString(),
      createdBy: currentUser?.name || 'Technicien Labo'
    });
    setShowQuoteModal(false);
    setQuoteEquip(''); setQuoteIssue(''); setQuoteAmount('');
  };

  const getPatientName = (patientId: string) => patients.find(p => p.id === patientId)?.name || 'Inconnu';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center">
            <FlaskConical className="w-8 h-8 mr-3 text-purple-600" />
            Laboratoire de Biologie
          </h1>
          <p className="text-slate-500 mt-1">Prélèvements et saisie des résultats d'analyses.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-md ring-1 ring-slate-200">
            <CardHeader className="bg-purple-600 rounded-t-xl text-white">
              <CardTitle className="text-xl">Analyses en Attente de Prélèvement/Saisie</CardTitle>
              <CardDescription className="text-purple-100">Bons réglés, prêts pour exécution par le laboratoire.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {[...paidOrders].reverse().map(ord => (
                  <div key={ord.id} className="p-6 bg-white hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center space-x-3 mb-1">
                          <h3 className="font-bold text-lg text-slate-900">{getPatientName(ord.patientId)}</h3>
                          <Badge variant="warning" className="bg-purple-100 text-purple-800 border-purple-200">Prêt pour prélèvement</Badge>
                        </div>
                        <p className="text-sm text-slate-500">N° {ord.id} • Prescrit par {ord.prescribedBy}</p>
                      </div>
                      <Button size="lg" onClick={() => handleSelectOrder(ord)} className="bg-purple-600 hover:bg-purple-700 shadow-sm">
                        Saisir les résultats
                      </Button>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-slate-700 font-medium font-mono text-sm leading-relaxed whitespace-pre-line">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Prescription détaillée :</span>
                      {ord.details}
                    </div>
                  </div>
                ))}
                {paidOrders.length === 0 && (
                  <div className="p-12 text-center flex flex-col items-center">
                    <CheckCircle className="w-12 h-12 text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium text-lg">Aucune analyse en attente de traitement.</p>
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
                 <p className="text-sm text-orange-800/80 mt-1">Ces analyses ont été prescrites par les médecins, mais les patients n'ont pas encore réglé à la caisse. Interdiction de prélever.</p>
               </div>
            </div>
          )}
        </div>
        
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-lg">Analyses Récentes (Terminées)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <ul className="divide-y divide-slate-100">
                {[...completedOrders].reverse().slice(0, 5).map(o => (
                  <li key={o.id} className="p-4 hover:bg-slate-50">
                    <div className="flex items-start">
                      <FileText className="w-4 h-4 text-slate-400 mt-1 mr-3 shrink-0" />
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{getPatientName(o.patientId)}</p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{o.details}</p>
                      </div>
                    </div>
                  </li>
                ))}
                {completedOrders.length === 0 && (
                   <li className="p-4 text-center text-sm text-slate-500">Aucune analyse récente.</li>
                )}
               </ul>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-lg">Gestion Opérationnelle</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-6">
              <div className="space-y-3">
                 <Button variant="outline" className="w-full text-purple-700 border-purple-200 hover:bg-purple-50" onClick={() => setShowPOModal(true)}>
                    <PackagePlus className="w-4 h-4 mr-2" /> Cmd Réactifs (PO)
                 </Button>
                 {myPOs.length > 0 && (
                  <div className="space-y-2">
                     {[...myPOs].reverse().map(po => (
                        <div key={po.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded border border-slate-100">
                           <span className="font-medium">{po.id}</span>
                           {po.status === 'pending' && <Badge variant="warning" className="text-[10px]">Compta</Badge>}
                           {po.status === 'approved' && <Badge variant="success" className="text-[10px]">Validé</Badge>}
                           {po.status === 'rejected' && <Badge variant="destructive" className="text-[10px]">Refusé</Badge>}
                        </div>
                     ))}
                  </div>
                 )}
              </div>
              <div className="space-y-3 pt-4 border-t border-slate-100">
                 <Button variant="outline" className="w-full text-orange-700 border-orange-200 hover:bg-orange-50" onClick={() => setShowQuoteModal(true)}>
                    <Wrench className="w-4 h-4 mr-2" /> Maintenance (Devis)
                 </Button>
                 {myQuotes.length > 0 && (
                  <div className="space-y-2">
                     {[...myQuotes].reverse().map(mq => (
                        <div key={mq.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded border border-slate-100">
                           <span className="font-medium line-clamp-1">{mq.equipment}</span>
                           {mq.status === 'pending' && <Badge variant="warning" className="text-[10px]">Attente</Badge>}
                           {mq.status === 'approved' && <Badge variant="success" className="text-[10px]">Approuvé</Badge>}
                        </div>
                     ))}
                  </div>
                 )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog size="xl" open={selectedOrder !== null} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogHeader>
          <DialogTitle>Saisie Professionnelle des Résultats (ISO 15189)</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-6 max-h-[70vh] overflow-y-auto pr-2">
          <p className="text-sm text-slate-600">Le format structuré assure une lecture standardisée par les médecins et facilite l'historique biologique des patients.</p>
          
          <div className="space-y-4">
             <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 px-2">
                <div className="col-span-4">Paramètre Analysé</div>
                <div className="col-span-2">Résultat</div>
                <div className="col-span-1">Flag</div>
                <div className="col-span-2">Unité</div>
                <div className="col-span-2">Réf. Normale</div>
                <div className="col-span-1"></div>
             </div>

             {labResultRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                   <div className="col-span-1 md:col-span-4">
                      <Input value={row.param} onChange={e => updateLabRow(idx, 'param', e.target.value)} placeholder="Ex: Hémoglobine" className="h-9 bg-white" />
                   </div>
                   <div className="col-span-1 md:col-span-2">
                      <Input value={row.result} onChange={e => updateLabRow(idx, 'result', e.target.value)} placeholder="Valeur" className={`h-9 bg-white font-bold ${row.flag !== 'normal' ? 'text-red-600' : ''}`} />
                   </div>
                   <div className="col-span-1 md:col-span-1">
                      <select value={row.flag} onChange={e => updateLabRow(idx, 'flag', e.target.value)} className={`w-full h-9 rounded-md border border-slate-300 text-sm px-2 bg-white ${row.flag !== 'normal' ? 'text-red-600 font-bold border-red-300' : ''}`}>
                         <option value="normal">-</option>
                         <option value="high">H (Haut)</option>
                         <option value="low">L (Bas)</option>
                      </select>
                   </div>
                   <div className="col-span-1 md:col-span-2">
                      <Input value={row.unit} onChange={e => updateLabRow(idx, 'unit', e.target.value)} placeholder="Ex: g/dL" className="h-9 bg-white" />
                   </div>
                   <div className="col-span-1 md:col-span-2">
                      <Input value={row.reference} onChange={e => updateLabRow(idx, 'reference', e.target.value)} placeholder="Ex: 12.0 - 16.0" className="h-9 bg-white text-xs" />
                   </div>
                   <div className="col-span-1 md:col-span-1 text-center">
                      <Button variant="ghost" onClick={() => removeLabRow(idx)} className="h-9 w-9 p-0 text-red-500 hover:bg-red-50 hover:text-red-700">×</Button>
                   </div>
                </div>
             ))}

             <Button variant="outline" onClick={addLabRow} className="w-full border-dashed text-purple-700 border-purple-200 hover:bg-purple-50">
                + Ajouter un paramètre
             </Button>
          </div>

          <div>
             <label className="text-sm font-semibold mb-2 block text-slate-700">Conclusion / Remarques Biologiste</label>
             <textarea 
               value={labGeneralNotes}
               onChange={(e) => setLabGeneralNotes(e.target.value)}
               className="w-full min-h-[100px] border border-slate-300 rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" 
               placeholder="Observations sur le prélèvement, conclusion générale..."
             ></textarea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSelectedOrder(null)}>Annuler</Button>
          <Button onClick={handleComplete} disabled={!labResultRows[0].param} className="bg-purple-600 hover:bg-purple-700">
            Signer & Transmettre
          </Button>
        </DialogFooter>
      </Dialog>
      
      {/* PO Modal */}
      <Dialog open={showPOModal} onOpenChange={setShowPOModal}>
        <DialogHeader>
          <DialogTitle>Nouveau Bon de Commande (Réactifs/Consommables)</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-slate-600">Listez les réactifs ou consommables nécessaires au laboratoire.</p>
          <div>
            <label className="text-sm font-semibold mb-1 block">Articles demandés</label>
            <textarea 
              value={poItems} onChange={e => setPoItems(e.target.value)}
              className="w-full min-h-[100px] border border-slate-200 rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" 
              placeholder="Ex: Kits Glucose, Tubes EDTA..."></textarea>
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Montant prévisionnel (GNF)</label>
            <Input type="number" value={poAmount} onChange={e => setPoAmount(e.target.value)} placeholder="Ex: 1500000" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowPOModal(false)}>Annuler</Button>
          <Button onClick={handleCreatePO} className="bg-purple-600 hover:bg-purple-700" disabled={!poItems}>
            Soumettre
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Quote Modal */}
      <Dialog open={showQuoteModal} onOpenChange={setShowQuoteModal}>
        <DialogHeader>
          <DialogTitle>Devis de Maintenance/Réparation</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-slate-600">Soumettez un devis pour la réparation ou maintenance d'un équipement du laboratoire.</p>
          <div>
            <label className="text-sm font-semibold mb-1 block">Équipement concerné</label>
            <Input value={quoteEquip} onChange={e => setQuoteEquip(e.target.value)} placeholder="Ex: Automate d'hématologie Sysmex..." />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Description de la panne / maintenance</label>
            <textarea 
              value={quoteIssue} onChange={e => setQuoteIssue(e.target.value)}
              className="w-full border border-slate-200 rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" 
              placeholder="Ex: Erreur de calibration capteur optique..."></textarea>
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Montant estimé (GNF)</label>
            <Input type="number" value={quoteAmount} onChange={e => setQuoteAmount(e.target.value)} placeholder="Ex: 500000" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowQuoteModal(false)}>Annuler</Button>
          <Button onClick={handleCreateQuote} className="bg-orange-600 hover:bg-orange-700" disabled={!quoteEquip || !quoteIssue}>
            Soumettre le devis
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
