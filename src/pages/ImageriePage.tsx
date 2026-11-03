import React, { useState, useEffect } from 'react';
import { useApp, generateId } from '../context/AppContext';
import { useAI } from '../context/AIContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Camera, Image as ImageIcon, AlertTriangle, CheckCircle, FileText, Wrench, PackagePlus, HardDrive } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';

export default function ImageriePage() {
  const { patients, orders, completeOrder, updatePatient, purchaseOrders, addPurchaseOrder, maintenanceQuotes, addMaintenanceQuote, currentUser } = useApp();
  const { registerPage, unregisterPage } = useAI();
  
  const imagerieOrders = orders.filter(o => o.type === 'imagerie');
  const paidOrders = imagerieOrders.filter(o => o.status === 'paid'); 
  const completedOrders = imagerieOrders.filter(o => o.status === 'completed');
  const pendingPaymentOrders = imagerieOrders.filter(o => o.status === 'pending');

  const myPOs = purchaseOrders.filter(po => po.service === 'imagerie');
  const myQuotes = maintenanceQuotes.filter(mq => mq.service === 'imagerie');

  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [showPOModal, setShowPOModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  
  const [reportTitle, setReportTitle] = useState('');
  const [reportProtocol, setReportProtocol] = useState('');
  const [reportFindings, setReportFindings] = useState('');
  const [reportConclusion, setReportConclusion] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  
  const [poItems, setPoItems] = useState('');
  const [poAmount, setPoAmount] = useState('');
  const [quoteEquip, setQuoteEquip] = useState('');
  const [quoteIssue, setQuoteIssue] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');

  // ── Enregistrement du contexte IA ────────────────────────────────────────
  useEffect(() => {
    registerPage(
      "Centre d'Imagerie Médicale",
      {
        reportTitle: "Titre de l'examen (ex: Échographie abdomino-pelvienne)",
        reportProtocol: "Protocole ou technique utilisée",
        reportFindings: "Description des images et constats",
        reportConclusion: "Conclusion du compte-rendu",
        action: "'open' pour ouvrir le 1er examen en attente"
      },
      (action) => {
        if (action.type === 'fill_form' && action.payload) {
          const payload = action.payload as Record<string, unknown>;
          if (typeof payload.reportTitle === 'string' && payload.reportTitle) setReportTitle(payload.reportTitle);
          if (typeof payload.reportProtocol === 'string' && payload.reportProtocol) setReportProtocol(payload.reportProtocol);
          if (typeof payload.reportFindings === 'string' && payload.reportFindings) setReportFindings(payload.reportFindings);
          if (typeof payload.reportConclusion === 'string' && payload.reportConclusion) setReportConclusion(payload.reportConclusion);
          if (payload.action === 'open' && paidOrders.length > 0) {
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

      // Transmet le compte-rendu au dossier médical du patient : le médecin
      // consulte le CR en temps réel dans l'onglet Historique (comme au labo).
      const patient = patients.find(p => p.id === order?.patientId);
      if (patient && order) {
        const newRecord = {
          id: generateId('IMA-RES'),
          date: new Date().toISOString(),
          type: 'imagerie_result',
          summary: reportTitle,
          details: {
            protocole: reportProtocol,
            constatations: reportFindings,
            conclusion: reportConclusion,
            cliches: uploadedImages.join(', '),
            prescripteur: order.prescribedBy,
            realizePar: currentUser?.name || 'Technicien Imagerie',
          }
        };
        updatePatient(patient.id, {
          medicalRecords: [...(patient.medicalRecords || []), newRecord]
        });
      }

      setSelectedOrder(null);
      setReportTitle('');
      setReportProtocol('');
      setReportFindings('');
      setReportConclusion('');
      setUploadedImages([]);
    }
  };

  const handleMockUpload = () => {
    setUploadedImages([...uploadedImages, `dicom-simulate-${Date.now()}.dcm`]);
  };

  const handleCreatePO = () => {
    if (!poItems) return;
    addPurchaseOrder({
      id: generateId(`PO-${new Date().getFullYear()}`),
      service: 'imagerie',
      items: poItems,
      amount: Math.max(0, parseInt(poAmount) || 0),
      status: 'pending',
      date: new Date().toISOString(),
      createdBy: currentUser?.name || 'Technicien Imagerie'
    });
    setShowPOModal(false);
    setPoItems(''); setPoAmount('');
  };

  const handleCreateQuote = () => {
    if (!quoteEquip || !quoteIssue) return;
    addMaintenanceQuote({
      id: generateId(`MQ-${new Date().getFullYear()}`),
      service: 'imagerie',
      equipment: quoteEquip,
      issue: quoteIssue,
      amount: Math.max(0, parseInt(quoteAmount) || 0),
      status: 'pending',
      date: new Date().toISOString(),
      createdBy: currentUser?.name || 'Technicien Imagerie'
    });
    setShowQuoteModal(false);
    setQuoteEquip(''); setQuoteIssue(''); setQuoteAmount('');
  };

  const getPatientName = (patientId: string) => patients.find(p => p.id === patientId)?.name || 'Inconnu';

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center">
            <Camera className="w-8 h-8 mr-3 text-cyan-600" />
            Centre d'Imagerie Médicale
          </h1>
          <p className="text-slate-500 mt-1">Échographie, Radiologie Numérique et Scanner. Saisie des comptes-rendus.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-md ring-1 ring-slate-200">
            <CardHeader className="bg-cyan-600 rounded-t-xl text-white">
              <CardTitle className="text-xl">Examens en Attente de Réalisation</CardTitle>
              <CardDescription className="text-cyan-100">Bons réglés, prêts pour le passage de l'examen.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {[...paidOrders].reverse().map(ord => (
                  <div key={ord.id} className="p-6 bg-white hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center space-x-3 mb-1">
                          <h3 className="font-bold text-lg text-slate-900">{getPatientName(ord.patientId)}</h3>
                          <Badge variant="warning" className="bg-cyan-100 text-cyan-800 border-cyan-200">Prêt pour examen</Badge>
                        </div>
                        <p className="text-sm text-slate-500">N° {ord.id} • Prescrit par {ord.prescribedBy}</p>
                      </div>
                      <Button size="lg" onClick={() => setSelectedOrder(ord.id)} className="bg-cyan-600 hover:bg-cyan-700 shadow-sm">
                        Rédiger le CR
                      </Button>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-slate-700 font-medium font-mono text-sm leading-relaxed whitespace-pre-line">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Détail de la prescription :</span>
                      {ord.details}
                    </div>
                  </div>
                ))}
                {paidOrders.length === 0 && (
                  <div className="p-12 text-center flex flex-col items-center">
                    <CheckCircle className="w-12 h-12 text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium text-lg">Aucun examen d'imagerie en attente.</p>
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
                 <p className="text-sm text-orange-800/80 mt-1">Ces examens ont été prescrits par les médecins, mais les patients n'ont pas encore réglé à la caisse. Examen non autorisé.</p>
               </div>
            </div>
          )}
        </div>
        
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-lg">Examens Récents (CR Validés)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <ul className="divide-y divide-slate-100">
                {[...completedOrders].reverse().slice(0, 5).map(o => (
                  <li key={o.id} className="p-4 hover:bg-slate-50">
                    <div className="flex items-start">
                      <ImageIcon className="w-4 h-4 text-cyan-600 mt-1 mr-3 shrink-0" />
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{getPatientName(o.patientId)}</p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{o.details}</p>
                      </div>
                    </div>
                  </li>
                ))}
                {completedOrders.length === 0 && (
                   <li className="p-4 text-center text-sm text-slate-500">Aucun examen récent.</li>
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
                 <Button variant="outline" className="w-full text-cyan-700 border-cyan-200 hover:bg-cyan-50" onClick={() => setShowPOModal(true)}>
                    <PackagePlus className="w-4 h-4 mr-2" /> Consommables & Films
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
                    <Wrench className="w-4 h-4 mr-2" /> Maintenance Équipement
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
          <DialogTitle>Compte-Rendu d'Imagerie</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-6 max-h-[70vh] overflow-y-auto pr-2">
          <p className="text-sm text-slate-600">Rédigez le compte-rendu radiologique officiel qui sera intégré au dossier du patient.</p>
          
          <div className="space-y-4">
             <div>
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Titre de l'Examen</label>
                <Input value={reportTitle} onChange={e => setReportTitle(e.target.value)} placeholder="Ex: Échographie Abdomino-Pelvienne" className="font-semibold text-slate-900 border-slate-300" />
             </div>
             <div>
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Technique / Protocole</label>
                <textarea 
                  value={reportProtocol}
                  onChange={(e) => setReportProtocol(e.target.value)}
                  className="w-full min-h-[60px] border border-slate-300 rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" 
                  placeholder="Appareil utilisé, modalités d'acquisition, avec ou sans injection..."
                ></textarea>
             </div>
             <div>
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Résultats / Description</label>
                <textarea 
                  value={reportFindings}
                  onChange={(e) => setReportFindings(e.target.value)}
                  className="w-full min-h-[150px] border border-slate-300 rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" 
                  placeholder="Décrivez les organes analysés et les anomalies constatées..."
                ></textarea>
             </div>
             <div>
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Conclusion <span className="text-red-500">*</span></label>
                <textarea 
                  value={reportConclusion}
                  onChange={(e) => setReportConclusion(e.target.value)}
                  className="w-full min-h-[80px] border border-slate-300 rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 font-bold" 
                  placeholder="Conclusion courte de l'examen..."
                ></textarea>
             </div>

             <div className="pt-4 border-t border-slate-100">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Sauvegarde Locale PACS / DICOM (Simulation)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                   {uploadedImages.map((img, i) => (
                      <Badge key={i} variant="outline" className="bg-slate-50 flex items-center space-x-2 py-1.5"><HardDrive className="w-3 h-3 text-cyan-600 mr-2"/> {img}</Badge>
                   ))}
                </div>
                <Button variant="outline" onClick={handleMockUpload} className="w-full border-dashed text-slate-500">
                   <ImageIcon className="w-4 h-4 mr-2" /> Joindre / Lier des clichés associés
                </Button>
             </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSelectedOrder(null)}>Annuler</Button>
          <Button onClick={handleComplete} disabled={!reportConclusion || !reportTitle} className="bg-cyan-600 hover:bg-cyan-700">
            Signer le CR & Transmettre
          </Button>
        </DialogFooter>
      </Dialog>
      
      {/* PO Modal */}
      <Dialog open={showPOModal} onOpenChange={setShowPOModal}>
        <DialogHeader>
          <DialogTitle>Besoins en Consommables Imagerie</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-slate-600">Demande d'achat de gel, films reprographes, seringues...</p>
          <div>
            <label className="text-sm font-semibold mb-1 block">Articles demandés</label>
            <textarea 
              value={poItems} onChange={e => setPoItems(e.target.value)}
              className="w-full min-h-[100px] border border-slate-200 rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" 
              placeholder="Ex: Cartons de reprographe, Gel échographique..."></textarea>
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Montant prévisionnel (GNF)</label>
            <Input type="number" value={poAmount} onChange={e => setPoAmount(e.target.value)} placeholder="Ex: 500000" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowPOModal(false)}>Annuler</Button>
          <Button onClick={handleCreatePO} className="bg-cyan-600 hover:bg-cyan-700" disabled={!poItems}>
            Soumettre
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Quote Modal */}
      <Dialog open={showQuoteModal} onOpenChange={setShowQuoteModal}>
        <DialogHeader>
          <DialogTitle>Devis de Maintenance/Réparation Imagerie</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-slate-600">Soumettez un devis pour la réparation d'un appareil (Sonde écho, capteur RX...).</p>
          <div>
            <label className="text-sm font-semibold mb-1 block">Équipement concerné</label>
            <Input value={quoteEquip} onChange={e => setQuoteEquip(e.target.value)} placeholder="Ex: Sonde linéaire échographe..." />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Description de la panne / maintenance</label>
            <textarea 
              value={quoteIssue} onChange={e => setQuoteIssue(e.target.value)}
              className="w-full border border-slate-200 rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" 
              placeholder="Ex: Faux contact sur le connecteur principal..."></textarea>
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Montant estimé (GNF)</label>
            <Input type="number" value={quoteAmount} onChange={e => setQuoteAmount(e.target.value)} placeholder="Ex: 2500000" />
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
