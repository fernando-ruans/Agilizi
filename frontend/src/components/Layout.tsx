import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Truck,
  Wrench,
  FileText,
  ClipboardList,
  DollarSign,
  Receipt,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Menu,
  X,
  ChevronDown,
  ShoppingCart,
  Package,
  BarChart3,
  UserRound,
  KeyRound,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Brand from './Brand';

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard, Users, Truck, Wrench, FileText, ClipboardList,
  DollarSign, Receipt, Settings, ShoppingCart, Package, BarChart3,
};

// Menu items filtered by company type (+ optional role restriction)
const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', types: ['loja', 'prestador', 'ambos'], roles: null },
  { path: '/clientes', label: 'Clientes', icon: 'Users', types: ['loja', 'prestador', 'ambos'], roles: null },
  { path: '/fornecedores', label: 'Fornecedores', icon: 'Truck', types: ['loja', 'prestador', 'ambos'], roles: null },
  { path: '/produtos', label: 'Produtos', icon: 'Package', types: ['loja', 'ambos'], roles: null },
  { path: '/servicos', label: 'Serviços', icon: 'Wrench', types: ['prestador', 'ambos'], roles: null },
  { path: '/vendas', label: 'Vendas', icon: 'ShoppingCart', types: ['loja', 'ambos'], roles: null },
  { path: '/orcamentos', label: 'Orçamentos', icon: 'FileText', types: ['prestador', 'ambos'], roles: null },
  { path: '/ordens-servico', label: 'Ordens de Serviço', icon: 'ClipboardList', types: ['prestador', 'ambos'], roles: null },
  { path: '/caixa', label: 'Caixa', icon: 'DollarSign', types: ['loja', 'prestador', 'ambos'], roles: null },
  { path: '/despesas', label: 'Despesas', icon: 'Receipt', types: ['loja', 'prestador', 'ambos'], roles: ['admin', 'gerente'] },
  { path: '/relatorios', label: 'Relatórios', icon: 'BarChart3', types: ['loja', 'prestador', 'ambos'], roles: null },
  { path: '/configuracoes', label: 'Configurações', icon: 'Settings', types: ['loja', 'prestador', 'ambos'], roles: null },
];

const typeLabels: Record<string, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  operacional: 'Operacional',
};

const companyTypeLabels: Record<string, string> = {
  loja: 'Loja',
  prestador: 'Prestador',
  ambos: 'Loja + Serviços',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, company, companyType, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const filteredMenu = menuItems.filter((item) => {
    const typeOk = companyType ? item.types.includes(companyType) : item.types.includes('ambos');
    const roleOk = !item.roles || (user?.role ? item.roles.includes(user.role) : false);
    return typeOk && roleOk;
  });

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [userMenuOpen]);

  useEffect(() => { setUserMenuOpen(false); setMobileOpen(false); }, [location.pathname]);

  // Close the mobile drawer with Escape (desktop collapse is unaffected)
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = user?.name?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || '?';

  return (
    <div className="flex h-screen bg-[#f8f9fb] dark:bg-slate-950">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/40 md:hidden"
        />
      )}
      <aside
        className={`${collapsed ? 'md:w-[60px]' : 'md:w-[240px]'} fixed inset-y-0 left-0 z-40 w-[260px] -translate-x-full transition-transform duration-200 ease-in-out md:static md:z-auto md:translate-x-0 ${mobileOpen ? 'translate-x-0' : ''} bg-white border-r border-gray-200 dark:bg-slate-900 dark:border-slate-800 md:transition-all flex flex-col shrink-0`}
      >
        <div className={`h-14 flex items-center border-b border-gray-100 dark:border-slate-800 ${collapsed ? 'justify-center px-2' : 'px-5 justify-between'}`}>
          <div className="flex items-center gap-2.5 md:hidden">
            <button onClick={() => setMobileOpen(false)} className="p-1.5 -ml-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800" aria-label="Fechar menu">
              <X size={17} />
            </button>
          </div>
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <Brand markSize={26} wordmarkSize={15} />
            </div>
          )}
          {collapsed && (
            <img src="/logo.svg" alt="Agilzi" width={24} height={24} draggable={false} className="hidden md:block text-slate-800 dark:text-slate-100" />
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="hidden md:block text-gray-400 hover:text-gray-600 transition-colors p-1 rounded dark:text-slate-500 dark:hover:text-slate-300" aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>
            {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Company info */}
        {!collapsed && company && (
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800">
            <p className="text-[12px] font-medium text-gray-700 truncate dark:text-slate-300">{company.tradeName || company.name}</p>
            <p className="text-[10px] text-gray-400 dark:text-slate-500">{companyTypeLabels[company.type] || company.type}</p>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-2 px-2">
          <ul>
            {filteredMenu.map((item) => {
              const Icon = iconMap[item.icon] || LayoutDashboard;
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-2.5 rounded-md text-[12.5px] font-medium transition-colors ${collapsed ? 'justify-center px-2 py-[7px]' : 'px-3 py-[7px]'} ${isActive ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'}`}
                  >
                    <Icon size={15} strokeWidth={isActive ? 2 : 1.5} className="shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-14 bg-white border-b border-gray-200 dark:bg-slate-900 dark:border-slate-800 flex items-center justify-between px-4 md:px-6 shrink-0">
          {/* Left side intentionally empty: the sidebar shows the company,
              the page content owns its single <h1> */}
          <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 -ml-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800" aria-label="Abrir menu">
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
              title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <div className="relative" ref={userMenuRef}>
              <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-gray-50 transition-colors dark:hover:bg-slate-800">
                {user?.avatar ? (
                  <img src={user.avatar} alt={"Foto de " + (user?.name || 'usuário')} className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-semibold dark:bg-slate-800 dark:text-slate-300">{initials}</div>
                )}
                <div className="text-left hidden sm:block">
                  <p className="text-[13px] font-medium text-gray-700 leading-tight dark:text-slate-200">{user?.name}</p>
                  <p className="text-[11px] text-gray-400 leading-tight dark:text-slate-500">{typeLabels[user?.role || '']}</p>
                </div>
                <ChevronDown size={14} className={`text-gray-400 transition-transform dark:text-slate-500 ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="fixed right-4 md:right-6 top-[62px] w-60 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-80px)] overflow-y-auto bg-white rounded-lg border border-gray-200 shadow-dropdown py-1 z-50 animate-fade-in dark:bg-slate-900 dark:border-slate-700">
                  <div className="px-3.5 py-2.5 border-b border-gray-100 dark:border-slate-800">
                    <p className="text-[13px] font-medium text-gray-800 dark:text-slate-100">{user?.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 dark:text-slate-500">{user?.email}</p>
                    {company && <p className="text-[10px] text-gray-400 mt-0.5 dark:text-slate-500">{company.name}</p>}
                  </div>

                  <div className="py-1">
                    <Link
                      to="/perfil"
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-600 hover:bg-gray-50 transition-colors dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <UserRound size={14} /> Meu perfil
                    </Link>
                    <Link
                      to="/perfil?tab=senha"
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-600 hover:bg-gray-50 transition-colors dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <KeyRound size={14} /> Alterar senha
                    </Link>
                    <Link
                      to="/configuracoes"
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-600 hover:bg-gray-50 transition-colors dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Settings size={14} /> Configurações
                    </Link>
                  </div>

                  <div className="border-t border-gray-100 pt-1 dark:border-slate-800">
                    <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors dark:text-red-400 dark:hover:bg-red-950/50">
                      <LogOut size={14} /> Sair da conta
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

<main className="flex-1 overflow-y-auto overflow-x-clip p-4 md:p-6 min-w-0">{children}</main>
      </div>
    </div>
  );
}
