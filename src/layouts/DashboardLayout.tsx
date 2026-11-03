import React, { useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ShieldPlus, LayoutDashboard, Users, CreditCard, Activity, Syringe, Settings, LogOut, TestTube, Crosshair, Store, Baby, Stethoscope, Menu, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { AIAssistant } from '../components/AIAssistant';

export default function DashboardLayout() {
  const { currentUser, logout, architectureMode, activeModules } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  // Audit Z2 : navigation mobile (menu latéral animé) — la sidebar desktop reste cachée < md
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const getNavItems = () => {
    if (!currentUser) return [];

    const items: { path: string; label: string; icon: typeof LayoutDashboard }[] = [];

    if (currentUser.role === 'super_admin') {
      items.push({ path: '/', label: 'Global Dashboard', icon: LayoutDashboard });
      items.push({ path: '/settings', label: 'Configuration', icon: Settings });
      items.push({ path: '/reception', label: 'Réception (Aperçu)', icon: Users });
      items.push({ path: '/doctor', label: 'Médecin Général (Aperçu)', icon: Activity });
      if (activeModules.gynecologie) items.push({ path: '/gyneco', label: 'Gynécologie (Aperçu)', icon: Users });
      if (activeModules.pediatrie) items.push({ path: '/pediatrie', label: 'Pédiatrie (Aperçu)', icon: Baby });
      items.push({ path: '/infirmier', label: 'Infirmier (Aperçu)', icon: Syringe });
      if (activeModules.pharmacie) items.push({ path: '/pharmacie', label: 'Pharmacie (Aperçu)', icon: Store });
      if (activeModules.laboratoire) items.push({ path: '/labo', label: 'Laboratoire (Aperçu)', icon: TestTube });
      if (activeModules.imagerie) items.push({ path: '/imagerie', label: 'Imagerie (Aperçu)', icon: Crosshair });
      items.push({ path: '/caisse', label: 'Caisse (Aperçu)', icon: CreditCard });
      items.push({ path: '/finance', label: 'Comptabilité (Aperçu)', icon: Activity });
    } else if (currentUser.role === 'receptionniste') {
      items.push({ path: '/reception', label: 'Réception', icon: Users });
      items.push({ path: '/', label: 'Dashboard', icon: LayoutDashboard });
    } else if (currentUser.role === 'caissier') {
      items.push({ path: '/caisse', label: 'Caisse', icon: CreditCard });
      items.push({ path: '/', label: 'Dashboard', icon: LayoutDashboard });
    } else if (currentUser.role === 'medecin') {
      if (currentUser.service === 'gynecologie') {
        items.push({ path: '/gyneco', label: 'Gynéco-Obstétrique', icon: Users });
        items.push({ path: '/doctor', label: 'Consultations Générales', icon: Activity });
      } else if (currentUser.service === 'pediatrie') {
        items.push({ path: '/pediatrie', label: 'Pédiatrie', icon: Baby });
        items.push({ path: '/doctor', label: 'Consultations Générales', icon: Activity });
      } else {
        items.push({ path: '/doctor', label: 'Consultations', icon: Activity });
        if (activeModules.gynecologie) {
          items.push({ path: '/gyneco', label: 'Gynéco-Obstétrique', icon: Users });
        }
        if (activeModules.pediatrie) {
          items.push({ path: '/pediatrie', label: 'Pédiatrie', icon: Baby });
        }
      }
      // NOTE : pas d'entrée « Interventions » ici — la page /chirurgie n'existe pas
      // encore (module en cours de développement, voir App.tsx route joker).
      items.push({ path: '/', label: 'Tableau de bord', icon: LayoutDashboard });
    } else if (currentUser.role === 'infirmier' || currentUser.role === 'sage_femme') {
       if (currentUser.role === 'sage_femme') {
         items.push({ path: '/gyneco', label: 'Maternité (DPU)', icon: Baby });
       } else {
         items.push({ path: '/infirmier', label: 'Soins Infirmiers', icon: Syringe });
       }
    } else if (currentUser.role === 'pharmacien') {
      items.push({ path: '/pharmacie', label: 'Pharmacie', icon: Store });
    } else if (currentUser.role === 'technicien_labo') {
      items.push({ path: '/labo', label: 'Laboratoire', icon: TestTube });
    } else if (currentUser.role === 'technicien_imagerie') {
      items.push({ path: '/imagerie', label: 'Imagerie', icon: Crosshair });
    } else if (currentUser.role === 'comptable' || currentUser.role === 'directeur_financier') {
      // Audit W2 : la route /caisse est autorisée à ces rôles — le nav suit le RBAC
      items.push({ path: '/finance', label: 'Finances', icon: Activity });
      items.push({ path: '/caisse', label: 'Caisse (supervision)', icon: CreditCard });
      items.push({ path: '/', label: 'Dashboard', icon: LayoutDashboard });
    }

    return items;
  };

  const navItems = getNavItems();

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
      {navItems.map((item, index) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path + item.label}
            to={item.path}
            onClick={onNavigate}
            style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
            className={cn(
              'relative flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group animate-in fade-in slide-in-from-left-2 fill-mode-both',
              isActive
                ? 'bg-blue-600/15 text-blue-400'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100 hover:translate-x-1'
            )}
          >
            {/* Indicateur actif (audit Z7) */}
            <span
              className={cn(
                'absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-blue-500 transition-all duration-300',
                isActive ? 'h-6 opacity-100' : 'h-0 opacity-0 group-hover:h-3 group-hover:opacity-60'
              )}
            />
            <Icon className={cn('w-5 h-5 mr-3 flex-shrink-0 transition-transform duration-200', isActive ? 'text-blue-500 scale-110' : 'text-slate-500 group-hover:text-slate-300 group-hover:scale-105')} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen bg-slate-50">
      {/* ── Sidebar desktop ─────────────────────────────────────────────── */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex text-slate-300">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950">
          <ShieldPlus className="w-6 h-6 text-blue-500 mr-2 animate-in zoom-in-50 duration-500" />
          <span className="font-bold text-white tracking-tight text-xl">Hospitalis</span>
        </div>

        <div className="p-4 border-b border-slate-800 flex items-center space-x-3 bg-slate-900/50">
          <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center flex-shrink-0 font-bold ring-2 ring-blue-500/20">
            {currentUser?.name.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{currentUser?.name}</p>
            <p className="text-xs text-slate-400 truncate capitalize">{currentUser?.role.replace('_', ' ')}</p>
            {currentUser?.service && (
               <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider mt-0.5">{currentUser.service}</p>
            )}
          </div>
        </div>

        <NavList />

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-slate-400 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 group"
          >
            <LogOut className="w-5 h-5 mr-3 text-slate-500 group-hover:text-red-400 transition-transform group-hover:-translate-x-0.5" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header mobile avec hamburger (audit Z2) */}
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 md:hidden">
          <div className="flex items-center">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="p-2 mr-2 text-slate-300 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <ShieldPlus className="w-5 h-5 text-blue-500 mr-2" />
            <span className="font-bold text-white text-lg">Hospitalis</span>
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        {/* Menu mobile : slide-over animé (audit Z2) */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-[90] md:hidden">
            <div
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85%] bg-slate-900 border-r border-slate-800 flex flex-col text-slate-300 animate-in slide-in-from-left duration-300">
              <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 bg-slate-950">
                <div className="flex items-center">
                  <ShieldPlus className="w-6 h-6 text-blue-500 mr-2" />
                  <span className="font-bold text-white text-lg">Hospitalis</span>
                </div>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-all hover:rotate-90 duration-300"
                  aria-label="Fermer le menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 border-b border-slate-800 flex items-center space-x-3 bg-slate-900/50">
                <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold ring-2 ring-blue-500/20">
                  {currentUser?.name.charAt(0)}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-white truncate">{currentUser?.name}</p>
                  <p className="text-xs text-slate-400 truncate capitalize">{currentUser?.role.replace('_', ' ')}</p>
                </div>
              </div>
              <NavList onNavigate={() => setMobileNavOpen(false)} />
              <div className="p-4 border-t border-slate-800">
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-slate-400 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-5 h-5 mr-3" />
                  Déconnexion
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Contenu avec transition de page (audit Z5) */}
        <div key={location.pathname} className="flex-1 overflow-y-auto p-4 md:p-8 relative page-fade">
          <Outlet />
        </div>
        <AIAssistant />
      </main>
    </div>
  );
}
