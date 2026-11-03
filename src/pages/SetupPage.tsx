import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, ArchitectureMode, ModuleType } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Building2, Layers, Check, Component } from 'lucide-react';
import { cn } from '../lib/utils';

export default function SetupPage() {
  const { setSetup, setArchitectureMode, activeModules, toggleModule } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedMode, setSelectedMode] = useState<ArchitectureMode>('clinic');

  const handleComplete = () => {
    setArchitectureMode(selectedMode);
    setSetup(true);
    navigate('/auth');
  };

  const modulesList: { id: ModuleType; label: string; desc: string }[] = [
    { id: 'cardiologie', label: 'Cardiologie', desc: 'Consultations et soins cardiologiques' },
    { id: 'gynecologie', label: 'Gynécologie', desc: 'Suivi de grossesse, accouchements' },
    { id: 'pediatrie', label: 'Pédiatrie', desc: 'Consultations et soins pédiatriques' },
    { id: 'chirurgie', label: 'Chirurgie', desc: 'Interventions et bloc opératoire' },
    { id: 'pharmacie', label: 'Pharmacie Interne', desc: 'Gestion des ordonnances et stocks' },
    { id: 'laboratoire', label: 'Laboratoire', desc: 'Examens de biologie en interne' },
    { id: 'imagerie', label: 'Centre d\'Imagerie', desc: 'Gestion des examens d\'imagerie' },
    { id: 'bloc', label: 'Bloc Opératoire', desc: 'Nécessite la chirurgie' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl border-slate-200">
        <CardHeader className="text-center border-b border-slate-100 pb-8 pt-8">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
            <Building2 className="text-blue-600 w-8 h-8" />
          </div>
          <CardTitle className="text-2xl font-bold">Configuration Initiale (Super Admin)</CardTitle>
          <p className="text-slate-500 mt-2">Étape {step} sur 2: {step === 1 ? 'Architecture' : 'Modules'}</p>
        </CardHeader>
        
        <CardContent className="p-8">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <button
                  onClick={() => setSelectedMode('clinic')}
                  className={cn(
                    "p-6 rounded-xl border text-left transition-all duration-200",
                    selectedMode === 'clinic' ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-200 hover:bg-slate-50"
                  )}
                >
                  <Building2 className={cn("w-8 h-8 mb-4", selectedMode === 'clinic' ? 'text-blue-600' : 'text-slate-400')} />
                  <h3 className="font-semibold text-lg mb-2">Mode Clinique</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Architecture non-cloisonnée. Un seul réceptionniste, médecins et infirmiers polyvalents. Salles communes.
                  </p>
                </button>
                <button
                  onClick={() => setSelectedMode('polyclinic')}
                  className={cn(
                    "p-6 rounded-xl border text-left transition-all duration-200",
                    selectedMode === 'polyclinic' ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-200 hover:bg-slate-50"
                  )}
                >
                  <Layers className={cn("w-8 h-8 mb-4", selectedMode === 'polyclinic' ? 'text-blue-600' : 'text-slate-400')} />
                  <h3 className="font-semibold text-lg mb-2">Mode Polyclinique</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Architecture cloisonnée par service. Personnel et ressources dédiés par spécialité (Cardiologie, etc.).
                  </p>
                </button>
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={() => setStep(2)}>Continuer &rarr;</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-3">
                {modulesList.map(mod => (
                  <button
                    key={mod.id}
                    onClick={() => toggleModule(mod.id)}
                    className={cn(
                      "flex items-start p-4 rounded-lg border text-left transition-colors",
                      activeModules[mod.id] ? "border-blue-200 bg-blue-50/50" : "border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 mr-3 border",
                      activeModules[mod.id] ? "bg-blue-600 border-blue-600" : "border-slate-300"
                    )}>
                      {activeModules[mod.id] && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900">{mod.label}</h4>
                      <p className="text-xs text-slate-500 mt-1">{mod.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>&larr; Retour</Button>
                <Button onClick={handleComplete}>Terminer la Configuration</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
