import React, { useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  ShieldPlus, LayoutDashboard, Users, CreditCard, Activity, Syringe, Settings, LogOut,
  TestTube, Crosshair, Store, Baby, Menu, X, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { AIAssistant } from '../components/AIAssistant';

export default function DashboardLayout() {
  const { currentUser, logout, activeModules, hospitalProfile } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Audit espace : sidebar repliable, état persisté
  const [collapsed, setCollapsed] = useState<boolean>(() => window.localStorage.getItem('hospi_sidebarCollapsed') === '1');
  const toggleCollapsed = () => {
    setCollapsed(v => {
      window.localStorage.setItem('hospi_sidebarCollapsed', v ? '0' : '1');
      return !v;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const getNavItems = () => {
    if (!currentUser) return [];
    const items: { path: string; label: string; icon: typeof LayoutDashboard }[] = [];

    if (currentUser.role === 'super_admin') {
      items.push({ path: '/', label: 'Tableau de bord', icon: LayoutDashboard });
      items.push({ path: '/settings', label: 'Configuration', icon: Settings });
      items.push({ path: '/reception', label: 'Réception', icon: Users });
      items.push({ path: '/doctor', label: 'Médecin Général', icon: Activity });
      if (activeModules.gynecologie) items.push({ path: '/gyneco', label: 'Gynécologie', icon: Baby });
      if (activeModules.pediatrie) items.push({ path: '/pediatrie', label: 'Pédiatrie', icon: Baby });
      items.push({ path: '/infirmier', label: 'Infirmier', icon: Syringe });
      if (activeModules.pharmacie) items.push({ path: '/pharmacie', label: 'Pharmacie', icon: Store });
      if (activeModules.laboratoire) items.push({ path: '/labo', label: 'Laboratoire', icon: TestTube });
      if (activeModules.imagerie) items.push({ path: '/imagerie', label: 'Imagerie', icon: Crosshair });
      items.push({ path: '/caisse', label: 'Caisse', icon: CreditCard });
      items.push({ path: '/finance', label: 'Comptabilité', icon: Activity });
    } else if (currentUser.role === 'receptionniste') {
      items.push({ path: '/reception', label: 'Réception', icon: Users });
      items.push({ path: '/', label: 'Tableau de bord', icon: LayoutDashboard });
    } else if (currentUser.role === 'caissier') {
      items.push({ path: '/caisse', label: 'Caisse', icon: CreditCard });
      items.push({ path: '/', label: 'Tableau de bord', icon: LayoutDashboard });
    } else if (currentUser.role === 'medecin') {
      if (currentUser.service === 'gynecologie') {
        items.push({ path: '/gyneco', label: 'Gynéco-Obstétrique', icon: Users });
        items.push({ path: '/doctor', label: 'Consult. Générales', icon: Activity });
      } else if (currentUser.service === 'pediatrie') {
        items.push({ path: '/pediatrie', label: 'Pédiatrie', icon: Baby });
        items.push({ path: '/doctor', label: 'Consult. Générales', icon: Activity });
      } else {
        items.push({ path: '/doctor', label: 'Consultations', icon: Activity });
        if (activeModules.gynecologie) items.push({ path: '/gyneco', label: 'Gynéco-Obstétrique', icon: Users });
        if (activeModules.pediatrie) items.push({ path: '/pediatrie', label: 'Pédiatrie', icon: Baby });
      }
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
      items.push({ path: '/finance', label: 'Finances', icon: Activity });
      items.push({ path: '/caisse', label: 'Caisse (supervision)', icon: CreditCard });
      items.push({ path: '/', label: 'Tableau de bord', icon: LayoutDashboard });
    }
    return items;
  };

  const navItems = getNavItems();

  // Liste de navigation partagée (desktop repliable + menu mobile)
  const NavList = ({ onNavigate, mini }: { onNavigate?: () => void; mini?: boolean }) => (
    <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
      {navItems.map((item, index) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path + item.label}
            to={item.path}
            onClick={onNavigate}
            title={mini ? item.label : undefined}
            style={{ animationDelay: `${Math.min(index * 35, 280)}ms` }}
            className={cn(
              'group relative flex items-center rounded-xl text-sm font-medium transition-all duration-250 animate-in fade-in slide-in-from-left-2 fill-mode-both',
              mini ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
              isActive
                ? 'bg-blue-600/15 text-blue-400'
                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 hover:translate-x-1',
            )}
          >
            <span className={cn(
              'absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-blue-500 transition-all duration-300',
              mini && 'left-1/2 -translate-x-1/2 top-auto bottom-0 w-5 h-[3px] rounded-full',
              isActive ? (mini ? 'opacity-100 h-[3px] w-5' : 'h-6 opacity-100') : 'opacity-0 h-0 group-hover:opacity-60',
              !mini && 'group-hover:h-3',
            )} />
            <Icon className={cn('flex-shrink-0 transition-transform duration-200', mini ? 'w-5 h-5' : 'w-5 h-5 mr-3', isActive ? 'text-blue-500 scale-110' : 'text-slate-500 group-hover:text-slate-300 group-hover:scale-105')} />
            {!mini && item.label}
            {/* Tooltip en mode réduit */}
            {mini && (
              <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-slate-800 text-xs font-medium text-white whitespace-nowrap opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 z-50 shadow-lg border border-slate-700">
                {item.label}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen bg-slate-50">
      {/* ══ Sidebar desktop (repliable) ══ */}
      <aside
        className={cn(
          'relative hidden md:flex flex-col bg-slate-900 border-r border-slate-800 text-slate-300 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          collapsed ? 'w-[76px]' : 'w-64',
        )}
      >
        {/* Poignée de repli (flottante sur le bord) */}
        <button
          onClick={toggleCollapsed}
          className="absolute -right-3.5 top-9 z-30 w-7 h-7 rounded-full bg-slate-800 border border-slate-700 grid place-items-center text-slate-400 hover:text-white hover:bg-slate-700 shadow-lg transition-all duration-200 hover:scale-110"
          aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
          title={collapsed ? 'Déplier' : 'Replier'}
        >
          {collapsed ? <ChevronsRight className="w-3.5 h-3.5" /> : <ChevronsLeft className="w-3.5 h-3.5" />}
        </button>

        <div className={cn('h-16 flex items-center border-b border-slate-800 bg-slate-950 overflow-hidden', collapsed ? 'justify-center px-0' : 'px-5')}>
          <ShieldPlus className="w-6 h-6 text-blue-500 shrink-0 animate-in zoom-in-50 duration-500" />
          <div className={cn('overflow-hidden transition-all duration-300', collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100 ml-2.5')}>
            <p className="font-bold text-white tracking-tight leading-none">Hospitalis</p>
            <p className="text-[10px] text-slate-500 truncate mt-1 uppercase tracking-wider">{hospitalProfile.name}</p>
          </div>
        </div>

        <div className={cn('border-b border-slate-800 flex items-center bg-slate-900/50 overflow-hidden', collapsed ? 'justify-center p-3' : 'p-4 space-x-3')}>
          <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 grid place-items-center flex-shrink-0 font-bold ring-2 ring-blue-500/20">
            {currentUser?.name.charAt(0)}
          </div>
          <div className={cn('overflow-hidden transition-all duration-300', collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100')}>
            <p className="text-sm font-medium text-white truncate">{currentUser?.name}</p>
            <p className="text-xs text-slate-400 truncate capitalize">{currentUser?.role.replace('_', ' ')}</p>
            {currentUser?.service && !collapsed && (
              <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider mt-0.5">{currentUser.service}</p>
            )}
          </div>
        </div>

        <NavList mini={collapsed} />

        <div className="p-3 border-t border-slate-800">
          <button
            onClick={handleLogout}
            title={collapsed ? 'Déconnexion' : undefined}
            className={cn(
              'flex items-center w-full text-sm font-medium text-slate-400 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 group',
              collapsed ? 'justify-center py-2.5' : 'px-3 py-2.5',
            )}
          >
            <LogOut className={cn('shrink-0 text-slate-500 group-hover:text-red-400 transition-transform duration-200 group-hover:-translate-x-0.5', collapsed ? 'w-5 h-5' : 'w-5 h-5 mr-3')} />
            {!collapsed && 'Déconnexion'}
          </button>
        </div>
      </aside>

      {/* ══ Contenu ══ */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header mobile */}
        <header className="h-16 glass border-b border-slate-200 flex items-center justify-between px-4 shrink-0 md:hidden">
          <div className="flex items-center min-w-0">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="p-2 mr-2 text-slate-600 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <ShieldPlus className="w-5 h-5 text-blue-600 mr-2 shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-slate-900 leading-none">Hospitalis</p>
              <p className="text-[10px] text-slate-400 truncate uppercase tracking-wider mt-0.5">{hospitalProfile.name}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 rounded-md hover:bg-slate-100 transition-colors" aria-label="Déconnexion">
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        {/* Menu mobile slide-over */}
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
                  <div>
                    <p className="font-bold text-white text-lg leading-none">Hospitalis</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{hospitalProfile.name}</p>
                  </div>
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

        {/* Zone de travail : largeur maîtrisée + transition de page */}
        <div key={location.pathname} className="flex-1 overflow-y-auto p-4 md:p-8 relative page-fade">
          <div className="mx-auto w-full max-w-[1440px]">
            <Outlet />
          </div>
        </div>
        <AIAssistant />
      </main>
    </div>
  );
}
