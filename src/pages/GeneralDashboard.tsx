import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Activity, Users, CreditCard, Stethoscope, Store, TestTube, Building2, TrendingUp, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';

/** Compteur animé (audit Z6) : interpolation cubique vers la valeur cible. */
function useCountUp(target: number, duration = 850): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/** Clé de jour (AAAA-MM-JJ) pour les comparaisons temporelles. */
const dayKey = (iso: string | undefined) => iso ? new Date(iso).toISOString().slice(0, 10) : '';

export default function GeneralDashboard() {
  const { patients, activeModules, architectureMode, currentUser, orders, consultations, payments, users, hospitalProfile } = useApp();

  const today = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);

  // ── Statistiques réelles ───────────────────────────────────────────────────
  const patientsToday = patients.filter(p => dayKey(p.arrivalTime) === today).length;
  const patientsYesterday = patients.filter(p => dayKey(p.arrivalTime) === yesterday).length;
  const patientsTrend = patientsToday - patientsYesterday;

  const revenueToday = payments.filter(p => dayKey(p.date) === today).reduce((acc, p) => acc + p.totalPaid, 0);
  const revenueYesterday = payments.filter(p => dayKey(p.date) === yesterday).reduce((acc, p) => acc + p.totalPaid, 0);
  const revenueTrend = revenueToday - revenueYesterday;

  const waitingPatients = patients.filter(p => p.status === 'waiting_consultation').length;
  const hospitalizedPatients = patients.filter(p => p.status === 'hospitalized').length;

  const consultationsToday = consultations.filter(c => dayKey(c.date) === today).length;
  const consultationsYesterday = consultations.filter(c => dayKey(c.date) === yesterday).length;
  const consultationsTrend = consultationsToday - consultationsYesterday;

  const totalPatients = patients.length;
  const totalConsultations = consultations.length;
  const totalRevenue = payments.reduce((acc, p) => acc + p.totalPaid, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-GN', { style: 'currency', currency: 'GNF', maximumFractionDigits: 0 }).format(amount);
  };

  interface StatCardProps {
    title: string;
    /** Valeur cible : nombre (animé en count-up) ou chaîne déjà formatée. */
    value: string | number;
    icon: React.ReactNode;
    trend?: number | null;
    trendLabel?: string;
    absoluteValue?: boolean;
    colorClass: string;
  }

  const StatCard = ({ title, value, icon, trend, trendLabel, absoluteValue, colorClass }: StatCardProps) => {
    // Audit Z6 : compteur animé pour les valeurs numériques (montants inclus)
    const isNumeric = typeof value === 'number';
    const animated = useCountUp(isNumeric ? value : 0);
    const display = isNumeric
      ? absoluteValue
        ? formatCurrency(animated)
        : animated.toLocaleString('fr-GN')
      : value;

    return (
      <Card
        className="border-0 shadow-sm ring-1 ring-slate-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:ring-slate-300 group"
      >
        <CardContent className="p-6">
           <div className="flex justify-between items-start">
             <div>
               <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
               <h3 className="text-3xl font-bold text-slate-900 tracking-tight tabular-nums">{display}</h3>
             </div>
             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorClass} transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6`}>
               {icon}
             </div>
           </div>
           {trend !== undefined && trend !== null && (
             <div className="mt-4 flex items-center text-sm">
                {trend > 0 ? (
                  <span className="text-green-600 font-medium flex items-center"><ArrowUpRight className="w-4 h-4 mr-0.5" /> {absoluteValue ? formatCurrency(trend) : `+${trend}`}</span>
                ) : trend < 0 ? (
                  <span className="text-red-600 font-medium flex items-center"><ArrowDownRight className="w-4 h-4 mr-0.5" /> {absoluteValue ? formatCurrency(Math.abs(trend)) : trend}</span>
                ) : (
                  <span className="text-slate-400 font-medium">stable</span>
                )}
                <span className="text-slate-400 ml-2">{trendLabel ?? 'vs hier'}</span>
             </div>
           )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 text-white p-8 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight">Bonjour, {currentUser?.name} 👋</h1>
          <p className="text-indigo-300/90 mt-1 text-sm font-semibold uppercase tracking-[0.14em]">{hospitalProfile.name}</p>
          <p className="text-indigo-200 mt-2 text-lg">
            Mode {architectureMode === 'polyclinic' ? 'Polyclinique' : 'Clinique'}, voici le résumé de l'activité du jour.
            {hospitalizedPatients > 0 && <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-200 text-sm font-semibold">· {hospitalizedPatients} hospitalisé{hospitalizedPatients > 1 ? 's' : ''}</span>}
          </p>
        </div>
        <div className="absolute right-0 top-0 opacity-10">
          <Building2 className="w-64 h-64 -mt-10 -mr-10" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Nouvelles Admissions (Auj.)"
          value={patientsToday}
          icon={<Users className="w-6 h-6 text-indigo-700" />}
          colorClass="bg-indigo-100/80"
          trend={patientsTrend}
        />
        <StatCard 
          title="Recettes du Jour"
          value={revenueToday}
          icon={<CreditCard className="w-6 h-6 text-emerald-700" />}
          colorClass="bg-emerald-100/80"
          trend={revenueTrend}
          absoluteValue
        />
         <StatCard 
          title="En Salle d'Attente"
          value={waitingPatients}
          icon={<Clock className="w-6 h-6 text-orange-700" />}
          colorClass="bg-orange-100/80"
          trend={null}
          trendLabel="patients en attente de consultation"
        />
        <StatCard 
          title="Consultations Clôturées (Auj.)"
          value={consultationsToday}
          icon={<Stethoscope className="w-6 h-6 text-blue-700" />}
          colorClass="bg-blue-100/80"
          trend={consultationsTrend}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <Card className="border-0 shadow-md ring-1 ring-slate-200">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-lg flex items-center">
              <Activity className="w-5 h-5 mr-2 text-slate-500" />
              Modules Opérationnels
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
               {Object.entries(activeModules).map(([key, isActive]) => {
                  if (!isActive) return null;
                  let Icon = Activity;
                  let color = "text-slate-600";
                  let bg = "bg-slate-100";
                  if (key === 'pharmacie') { Icon = Store; color = "text-emerald-700"; bg = "bg-emerald-50 border-emerald-200"; }
                  if (key === 'laboratoire') { Icon = TestTube; color = "text-purple-700"; bg = "bg-purple-50 border-purple-200"; }
                  if (key === 'imagerie') { Icon = Activity; color = "text-cyan-700"; bg = "bg-cyan-50 border-cyan-200"; }
                  
                  return (
                    <div key={key} className={`flex flex-col items-center justify-center p-4 rounded-xl border ${bg} transition-transform hover:scale-105`}>
                      <Icon className={`w-8 h-8 mb-2 ${color}`} />
                      <span className={`text-sm font-semibold capitalize ${color}`}>{key}</span>
                    </div>
                  );
               })}
             </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md ring-1 ring-slate-200">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-lg flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-slate-500" />
              Activité Récente
            </CardTitle>
            <p className="text-xs text-slate-400">
              Cumuls depuis l'ouverture : {totalPatients} patients • {totalConsultations} consultations • {formatCurrency(totalRevenue)} encaissés
            </p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
               
               {(() => {
                 // Construit un flux chronologique à partir des vraies données
                 interface FeedItem { id: string; title: string; subtitle: string; date: Date; icon: typeof Users; bgColor: string; textColor: string; }
                 const feed: FeedItem[] = [];
                 
                 patients.forEach(p => {
                    if (!p.arrivalTime) return;
                    feed.push({ id: `pat-${p.id}`, title: 'Nouvelle admission', subtitle: `${p.name} orienté vers ${p.targetService}`, date: new Date(p.arrivalTime), icon: Users, bgColor: 'bg-blue-100', textColor: 'text-blue-600' });
                 });
                 
                 payments.forEach(p => {
                    feed.push({ id: `pay-${p.id}`, title: 'Paiement reçu', subtitle: `${p.totalPaid.toLocaleString('fr-GN')} GNF via ${p.paymentMethod.replace('_', ' ')}`, date: new Date(p.date), icon: CreditCard, bgColor: 'bg-emerald-100', textColor: 'text-emerald-600' });
                 });
                 
                 consultations.forEach(c => {
                    const doctorName = users.find(u => u.id === c.doctorId)?.name || 'Consultant';
                    feed.push({ id: `cons-${c.id}`, title: 'Consultation terminée', subtitle: `Dr. ${doctorName} — ${c.finalDiagnosis || 'Diagnostic consigné'}`, date: new Date(c.date), icon: Stethoscope, bgColor: 'bg-indigo-100', textColor: 'text-indigo-600' });
                 });

                 orders.filter(o => o.status === 'completed').forEach(o => {
                    feed.push({ id: `ord-${o.id}`, title: 'Service exécuté', subtitle: `Soin/Examen ID ${o.id}`, date: new Date(o.date), icon: Store, bgColor: 'bg-teal-100', textColor: 'text-teal-600' });
                 });

                 feed.sort((a, b) => b.date.getTime() - a.date.getTime());
                 
                 return feed.length === 0 ? (
                   <p className="text-center text-sm text-slate-500 py-8 bg-slate-50 rounded-xl">Aucune activité récente.</p>
                 ) : feed.slice(0, 5).map(item => (
                  <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border border-white ${item.bgColor} ${item.textColor} shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm`}>
                          <item.icon className="w-4 h-4" />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between space-x-2 mb-1">
                              <div className="font-bold text-slate-900 text-sm">{item.title}</div>
                              <time className="font-mono text-[10px] text-slate-500">{item.date.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}</time>
                          </div>
                          <div className="text-xs text-slate-600">{item.subtitle}</div>
                      </div>
                  </div>
                 ));
               })()}

            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
