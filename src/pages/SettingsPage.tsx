import React, { useState } from 'react';
import { useApp, ModuleType, ServiceBudgets, HospitalProfile } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Settings, SwitchCamera, Activity, Power, Coins, Trash2, Building2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';

export default function SettingsPage() {
  const { architectureMode, activeModules, setArchitectureMode, setActiveModules, serviceBudgets, setServiceBudgets, resetAllData, hospitalProfile, setHospitalProfile } = useApp();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState<ServiceBudgets>(serviceBudgets);
  const [profileDraft, setProfileDraft] = useState<HospitalProfile>(hospitalProfile);

  const toggleModule = (moduleKey: keyof typeof activeModules) => {
    setActiveModules({
      ...activeModules,
      [moduleKey]: !activeModules[moduleKey]
    });
  };

  const handleModeChange = () => {
    setArchitectureMode(architectureMode === 'clinic' ? 'polyclinic' : 'clinic');
  };

  const handleBudgetChange = (service: string, value: string) => {
    const parsed = Math.max(0, parseInt(value) || 0);
    setBudgetDraft(prev => ({ ...prev, [service]: parsed }));
  };

  const saveBudgets = () => {
    setServiceBudgets(budgetDraft);
  };

  const moduleLabels: Record<ModuleType, string> = {
    cardiologie: 'Cardiologie',
    gynecologie: 'Gynécologie',
    pediatrie: 'Pédiatrie',
    chirurgie: 'Chirurgie',
    pharmacie: 'Pharmacie Interne',
    laboratoire: 'Laboratoire',
    imagerie: 'Centre d\'Imagerie',
    bloc: 'Bloc Opératoire',
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-GN', { style: 'currency', currency: 'GNF', maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center">
            <Settings className="w-8 h-8 mr-3 text-slate-700" />
            Paramètres du Système
          </h1>
          <p className="text-slate-500 mt-1">Configuration de l'architecture, des modules et des budgets.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card className="border-0 shadow-sm ring-1 ring-slate-200">
           <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg flex items-center">
              <SwitchCamera className="w-5 h-5 mr-2 text-blue-600" />
              Architecture de l'Établissement
            </CardTitle>
            <CardDescription>Basculez entre le mode Clinique et Polyclinique.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
             <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-white">
                <div>
                  <h3 className="font-bold text-slate-900">Mode {architectureMode === 'clinic' ? 'Clinique' : 'Polyclinique'}</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-sm">
                    {architectureMode === 'clinic' 
                      ? 'Parcours unifié. Les patients ne sont pas fortement segmentés par service (parfait pour les petits cabinets).'
                      : 'Parcours segmenté. La réception doit choisir un service cible (Géné, Pédiatrie...) à chaque accueil.'}
                  </p>
                </div>
                <Button onClick={handleModeChange} variant="outline" className="shrink-0 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">
                   Changer de Mode
                </Button>
             </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-slate-200">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg flex items-center">
              <Activity className="w-5 h-5 mr-2 text-green-600" />
              Activation des Modules
            </CardTitle>
            <CardDescription>Activez ou désactivez les services spécialisés.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100">
              {(Object.keys(activeModules) as ModuleType[]).map(key => (
                  <li key={key} className="flex items-center justify-between p-4 hover:bg-slate-50">
                  <div className="font-medium text-slate-800">
                      {moduleLabels[key]}
                  </div>
                  <Button 
                    onClick={() => toggleModule(key)}
                    variant={activeModules[key] ? 'default' : 'outline'}
                    className={activeModules[key] ? 'bg-green-600 hover:bg-green-700' : 'text-slate-500 hover:bg-slate-100'}
                    size="sm"
                  >
                    {activeModules[key] ? (
                      <><Power className="w-4 h-4 mr-2" /> Actif</>
                    ) : (
                       <><Power className="w-4 h-4 mr-2" /> Inactif</>
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-slate-200">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-lg flex items-center">
            <Building2 className="w-5 h-5 mr-2 text-blue-600" />
            Identité de l'établissement
          </CardTitle>
          <CardDescription>Affichée sur la sidebar, les reçus de caisse et les ordonnances.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="text-micro block mb-1.5">Nom</label>
              <Input value={profileDraft.name} onChange={e => setProfileDraft({ ...profileDraft, name: e.target.value })} className="h-10" />
            </div>
            <div>
              <label className="text-micro block mb-1.5">Ville</label>
              <Input value={profileDraft.city} onChange={e => setProfileDraft({ ...profileDraft, city: e.target.value })} className="h-10" />
            </div>
            <div>
              <label className="text-micro block mb-1.5">Téléphone</label>
              <Input value={profileDraft.phone} onChange={e => setProfileDraft({ ...profileDraft, phone: e.target.value })} className="h-10" />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button
              onClick={() => setHospitalProfile(profileDraft)}
              disabled={JSON.stringify(profileDraft) === JSON.stringify(hospitalProfile) || !profileDraft.name.trim()}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110"
            >
              Enregistrer l'identité
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm ring-1 ring-slate-200">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-lg flex items-center">
            <Coins className="w-5 h-5 mr-2 text-indigo-600" />
            Budgets Mensuels par Service (GNF)
          </CardTitle>
          <CardDescription>
            Enveloppe allouée à chaque service logistique, consommée par les bons de commande et devis validés en comptabilité.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(budgetDraft).map(([service, amount]) => (
              <div key={service} className="p-4 border border-slate-200 rounded-xl bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold capitalize text-slate-700">{service}</span>
                  <Badge variant="outline" className="text-[10px]">{formatCurrency(amount)}</Badge>
                </div>
                <Input
                  type="number"
                  min="0"
                  step="1000000"
                  value={amount}
                  onChange={e => handleBudgetChange(service, e.target.value)}
                  className="bg-white"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={saveBudgets} disabled={JSON.stringify(budgetDraft) === JSON.stringify(serviceBudgets)} className="bg-indigo-600 hover:bg-indigo-700">
              Enregistrer les budgets
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200 shadow-sm ring-1 ring-red-100">
        <CardHeader className="bg-red-50/50 border-b border-red-100">
          <CardTitle className="text-lg flex items-center text-red-700">
            <Trash2 className="w-5 h-5 mr-2" />
            Zone Sensible — Réinitialisation
          </CardTitle>
          <CardDescription>Efface définitivement toutes les données locales (patients, consultations, paiements, comptes, configuration).</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <Button variant="destructive" onClick={() => setShowResetConfirm(true)}>
            <Trash2 className="w-4 h-4 mr-2" /> Réinitialiser toutes les données
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogHeader>
          <DialogTitle>Confirmer la réinitialisation complète ?</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-3">
          <p className="text-sm text-slate-600">
            Cette action va <strong>effacer toutes les données</strong> stockées dans ce navigateur :
            patients, consultations, ordonnances, paiements, comptes utilisateurs, modules et budgets.
            L'application redémarrera ensuite comme au premier jour (écran de configuration initiale).
          </p>
          <p className="text-sm font-medium text-red-700">Cette action est irréversible.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowResetConfirm(false)}>Annuler</Button>
          <Button variant="destructive" onClick={resetAllData}>
            Oui, tout effacer
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
