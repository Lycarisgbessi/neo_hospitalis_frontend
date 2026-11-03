import React, { useState, useEffect, useMemo } from 'react';
import { useApp, StockItem, generateId } from '../context/AppContext';
import { useAI } from '../context/AIContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Store, Search, AlertTriangle, CheckCircle, PackagePlus, Plus } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';
import { useToast } from '../components/Toast';

export default function PharmacyPage() {
  const { patients, orders, completeOrder, updateStockItem, updatePatient, purchaseOrders, addPurchaseOrder, currentUser, pharmacyStock, setPharmacyStock } = useApp();
  const { registerPage, unregisterPage } = useAI();
  const toast = useToast();

  const pharmacyOrders = orders.filter(o => o.type === 'pharmacy');
  const paidOrders = pharmacyOrders.filter(o => o.status === 'paid');
  const pendingPaymentOrders = pharmacyOrders.filter(o => o.status === 'pending');

  const myPurchaseOrders = purchaseOrders.filter(po => po.service === 'pharmacie');

  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [showPOModal, setShowPOModal] = useState(false);
  const [poItems, setPoItems] = useState('');
  const [poAmount, setPoAmount] = useState('');

  // Recherche fonctionnelle dans le stock persistant
  const [stockSearch, setStockSearch] = useState('');

  // Quantités consommées par article pour la délivrance en cours
  const [consumption, setConsumption] = useState<Record<string, number>>({});

  // ── Enregistrement du contexte IA ────────────────────────────────────────
  useEffect(() => {
    registerPage(
      'Pharmacie Interne',
      {
        action: "'deliver' pour délivrer l'ordonnance la plus récente, 'restock' pour ouvrir la demande de réapprovisionnement",
        orderId: "Numéro de l'ordonnance à traiter (ex: ORD-001)",
        poItems: "Liste des articles à commander pour le réapprovisionnement"
      },
      (action) => {
        if (action.type === 'fill_form' && action.payload) {
          const payload = action.payload as Record<string, unknown>;
          if (payload.action === 'restock') setShowPOModal(true);
          if (typeof payload.orderId === 'string') {
            const ord = paidOrders.find(o => o.id === payload.orderId);
            if (ord) setSelectedOrder(ord.id);
          } else if (payload.action === 'deliver' && paidOrders.length > 0) {
            setSelectedOrder(paidOrders[0].id);
          }
          if (typeof payload.poItems === 'string') setPoItems(payload.poItems);
        }
      }
    );
    return () => unregisterPage();
  }, [registerPage, unregisterPage, paidOrders]);

  const filteredStock = useMemo(
    () => pharmacyStock.filter(it => it.name.toLowerCase().includes(stockSearch.trim().toLowerCase())),
    [pharmacyStock, stockSearch]
  );

  const setConsumed = (itemId: string, value: string) => {
    const qty = Math.max(0, parseInt(value) || 0);
    setConsumption(prev => ({ ...prev, [itemId]: qty }));
  };

  const openDelivery = (orderId: string) => {
    setSelectedOrder(orderId);
    // Pré-sélection vide : le pharmacien indique ce qu'il consomme réellement.
    setConsumption({});
  };

  const handleDeliver = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    completeOrder(orderId);

    // Traçabilité de la dispensation dans le dossier médical longitudinal (audit B3)
    const patient = patients.find(p => p.id === order?.patientId);
    if (patient && order) {
      updatePatient(patient.id, {
        medicalRecords: [...(patient.medicalRecords || []), {
          id: generateId('DISP'),
          date: new Date().toISOString(),
          type: 'dispensation',
          summary: 'Médicaments délivrés à la pharmacie',
          details: {
            medicaments: order.details,
            delivrePar: currentUser?.name || 'Pharmacien',
          }
        }]
      });
    }

    // Décrément réel et persistant du stock selon les quantités saisies.
    pharmacyStock.forEach(item => {
      const consumed = consumption[item.id] || 0;
      if (consumed > 0) {
        updateStockItem(item.id, { quantity: Math.max(0, item.quantity - consumed) });
      }
    });

    setSelectedOrder(null);
    setConsumption({});
    toast.success('Médicaments délivrés — stock de la pharmacie décrémenté.');
  };

  const handleRestock = () => {
    // Remet à niveau les articles dont la quantité est sous le seuil d'alerte.
    setPharmacyStock(pharmacyStock.map(it => ({
      ...it,
      quantity: it.quantity < it.threshold ? it.threshold * 5 : it.quantity,
    })));
  };

  const handleCreatePO = () => {
    if (!poItems) return;
    addPurchaseOrder({
      id: generateId(`PO-${new Date().getFullYear()}`),
      service: 'pharmacie',
      items: poItems,
      amount: Math.max(0, parseInt(poAmount) || 0),
      status: 'pending',
      date: new Date().toISOString(),
      createdBy: currentUser?.name || 'Pharmacien'
    });
    setShowPOModal(false);
    setPoItems('');
    setPoAmount('');
  };

  const getPatientName = (patientId: string) => patients.find(p => p.id === patientId)?.name || 'Inconnu';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center">
            <Store className="w-8 h-8 mr-3 text-emerald-600" />
            Pharmacie Interne
          </h1>
          <p className="text-slate-500 mt-1">Dispensation des ordonnances et gestion des stocks.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-md ring-1 ring-slate-200">
            <CardHeader className="bg-emerald-600 rounded-t-xl text-white">
              <CardTitle className="text-xl">Comptoir de Délivrance</CardTitle>
              <CardDescription className="text-emerald-100">Ordonnances réglées, en attente de délivrance au patient.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {[...paidOrders].reverse().map(ord => (
                  <div key={ord.id} className="p-6 bg-white hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center space-x-3 mb-1">
                          <h3 className="font-bold text-lg text-slate-900">{getPatientName(ord.patientId)}</h3>
                          <Badge variant="success">Payé & Prêt</Badge>
                        </div>
                        <p className="text-sm text-slate-500">N° {ord.id} • Prescrit par {ord.prescribedBy}</p>
                      </div>
                      <Button size="lg" onClick={() => openDelivery(ord.id)} className="bg-emerald-600 hover:bg-emerald-700 shadow-sm">
                        Traiter l'ordonnance
                      </Button>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-slate-700 font-medium font-mono text-sm whitespace-pre-line">
                      {ord.details}
                    </div>
                  </div>
                ))}
                {paidOrders.length === 0 && (
                  <div className="p-12 text-center flex flex-col items-center">
                    <CheckCircle className="w-12 h-12 text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium text-lg">Aucune ordonnance en attente de délivrance.</p>
                    <p className="text-sm text-slate-400 mt-1">Les patients doivent d'abord payer à la caisse.</p>
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
                 <h4 className="font-semibold text-orange-900">Ordonnances en attente de paiement ({pendingPaymentOrders.length})</h4>
                 <p className="text-sm text-orange-800/80 mt-1">Ces prescriptions ont été émises mais le patient n'est pas encore passé à la caisse. Vous ne pouvez pas les délivrer pour le moment.</p>
               </div>
            </div>
          )}
        </div>
        
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-lg">État des Stocks</CardTitle>
              <p className="text-xs text-slate-400">{pharmacyStock.length} articles référencés • sauvegarde persistante</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 border-b border-slate-100 relative">
                <Search className="w-4 h-4 absolute left-7 top-6 text-slate-400" />
                <Input
                  className="pl-9 bg-white"
                  placeholder="Rechercher un médicament..."
                  value={stockSearch}
                  onChange={e => setStockSearch(e.target.value)}
                />
              </div>
              <ul className="divide-y divide-slate-100 p-2">
                {filteredStock.map((item: StockItem) => (
                  <li key={item.id} className={`flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg ${item.quantity === 0 ? 'bg-red-50/50' : ''}`}>
                    <span className={`font-medium ${item.quantity === 0 ? 'text-red-900' : 'text-slate-700'}`}>{item.name}</span>
                    <Badge variant={item.quantity > item.threshold ? 'success' : item.quantity > 0 ? 'warning' : 'destructive'}>
                      {item.quantity > 0 ? `${item.quantity} ${item.unit}` : 'Rupture'}
                    </Badge>
                  </li>
                ))}
                {filteredStock.length === 0 && (
                  <li className="p-4 text-center text-sm text-slate-500">Aucun article ne correspond à « {stockSearch} ».</li>
                )}
              </ul>
              <div className="p-4 border-t border-slate-100 flex flex-col space-y-3">
                <Button variant="outline" className="w-full text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={() => setShowPOModal(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Demande de réapprovisionnement
                </Button>
                <Button variant="ghost" size="sm" className="w-full text-slate-500" onClick={handleRestock}>
                  <PackagePlus className="w-4 h-4 mr-2" /> Simuler une réception fournisseur (réassort auto)
                </Button>
                {myPurchaseOrders.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Bons de commande récents</h4>
                    <div className="space-y-2">
                      {[...myPurchaseOrders].reverse().map(po => (
                        <div key={po.id} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded">
                          <span className="font-medium">{po.id}</span>
                          {po.status === 'pending' && <Badge variant="warning">En attente (Compta)</Badge>}
                          {po.status === 'approved' && <Badge variant="success">Validé</Badge>}
                          {po.status === 'rejected' && <Badge variant="destructive">Refusé</Badge>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={selectedOrder !== null} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogHeader>
          <DialogTitle>Validation de Délivrance</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-5">
          <p className="text-sm text-slate-600">
            Veuillez confirmer les médicaments préparés pour le patient et indiquer les quantités
            consommées sur le stock (décrémentées automatiquement et de façon persistante).
          </p>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {pharmacyStock.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">Disponible : {item.quantity} {item.unit}</p>
                </div>
                <Input
                  type="number"
                  min="0"
                  max={item.quantity}
                  value={consumption[item.id] ?? 0}
                  onChange={e => setConsumed(item.id, e.target.value)}
                  className="w-20 bg-white text-center"
                />
              </div>
            ))}
          </div>
          <div>
            <textarea className="w-full min-h-[80px] border border-slate-200 rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Observations du pharmacien (substitutions, indisponibilités...) (optionnel)..."></textarea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSelectedOrder(null)}>Annuler</Button>
          <Button onClick={() => selectedOrder && handleDeliver(selectedOrder)} className="bg-emerald-600 hover:bg-emerald-700">
            Confirmer la délivrance
          </Button>
        </DialogFooter>
      </Dialog>

      {/* PO Modal */}
      <Dialog open={showPOModal} onOpenChange={setShowPOModal}>
        <DialogHeader>
          <DialogTitle>Nouveau Bon de Commande</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-slate-600">Saisissez les articles en rupture pour demander un réapprovisionnement à la comptabilité/direction.</p>
          <div>
            <label className="text-sm font-semibold mb-1 block">Articles demandés</label>
            <textarea 
              value={poItems} onChange={e => setPoItems(e.target.value)}
              className="w-full min-h-[100px] border border-slate-200 rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500" 
              placeholder="Ex: 50x Paracetamol 1000mg, 20x Amoxicilline..."></textarea>
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Montant prévisionnel (Optionnel - GNF)</label>
            <Input type="number" value={poAmount} onChange={e => setPoAmount(e.target.value)} placeholder="Ex: 500000" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowPOModal(false)}>Annuler</Button>
          <Button onClick={handleCreatePO} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50" disabled={!poItems}>
            Soumettre à la Comptabilité
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
