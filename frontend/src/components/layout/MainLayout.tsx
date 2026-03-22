import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  BookOpen,
  Target,
  BarChart2,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/journal', icon: BookOpen, label: 'Journal' },
  { to: '/budget', icon: Target, label: 'Budget' },
  { to: '/analysis', icon: BarChart2, label: 'Analysis' },
];

const settingsItem = { to: '/settings', icon: Settings, label: 'Settings' };

export default function MainLayout() {
  const { profile, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setSignOutError(null);
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Sign out failed', err);
      setSignOutError('Sign out failed. Please try again.');
    }
  };

  return (
    <div className="flex h-screen">
      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <aside
        className={`glass-sidebar hidden md:flex flex-col p-3 gap-1 transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Logo + collapse toggle */}
        <div className={`flex items-center mb-6 px-1 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-xl font-bold">FinPulse</h1>
              <p className="text-xs text-muted-foreground truncate">
                {profile?.display_name ?? '...'}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Main nav */}
        <nav className="flex-1 flex flex-col gap-1">
          {[...navItems, settingsItem].map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center rounded-md px-2 py-2 text-sm transition-colors min-h-[44px] ${
                  collapsed ? 'justify-center' : 'gap-3'
                } ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                }`
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Sign out */}
        <div className="mt-auto border-t pt-3 space-y-2">
          {signOutError && !collapsed && (
            <p className="text-xs text-destructive px-2">{signOutError}</p>
          )}
          <Button
            variant="ghost"
            className={`w-full text-muted-foreground min-h-[44px] ${
              collapsed ? 'justify-center px-2' : 'justify-start gap-3'
            }`}
            onClick={handleSignOut}
            title={collapsed ? 'Sign out' : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </Button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="glass-header md:hidden flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold">FinPulse</h1>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center justify-center h-10 w-10 rounded-md transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </NavLink>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile Bottom Navigation ──────────────────────────────── */}
      <nav className="glass-nav md:hidden fixed bottom-0 left-0 right-0 flex justify-around z-50" style={{ height: 64 }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 flex-1 px-2 rounded-md text-xs transition-all duration-100 active:scale-95 ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-5 w-5 ${isActive ? 'fill-primary stroke-primary' : ''}`} />
                {isActive && <span className="text-[10px] font-medium">{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
