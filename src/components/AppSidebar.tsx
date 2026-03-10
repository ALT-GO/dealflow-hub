import { Briefcase, Building2, Users, LogOut, Settings, Zap, TrendingUp } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const navItems = [
  { title: 'Negócios', url: '/', icon: Briefcase },
  { title: 'Empresas', url: '/companies', icon: Building2 },
  { title: 'Contatos', url: '/contacts', icon: Users },
  { title: 'Performance', url: '/performance', icon: TrendingUp },
];

const settingsItems = [
  { title: 'Configurações', url: '/settings', icon: Settings },
  { title: 'Automações', url: '/settings/automations', icon: Zap },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { signOut, user, role } = useAuth();
  const location = useLocation();

  const isActive = (url: string) => {
    if (url === '/') return location.pathname === '/';
    return location.pathname.startsWith(url);
  };

  const renderNavItem = (item: typeof navItems[0]) => {
    const active = isActive(item.url);
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end={item.url === '/'}
            className="relative rounded-lg transition-all duration-200 hover:bg-sidebar-accent"
            activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
          >
            {/* Active bar indicator */}
            {active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />
            )}
            <item.icon
              className="mr-2 h-[18px] w-[18px] transition-all duration-200"
              fill={active ? 'currentColor' : 'none'}
              strokeWidth={active ? 1.5 : 1.75}
            />
            {!collapsed && <span className="text-[13px]">{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={`px-4 py-5 ${collapsed ? 'px-2' : ''}`}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary/20">
              <span className="text-sidebar-primary font-display font-extrabold text-lg tracking-tighter">o</span>
            </div>
            {!collapsed && (
              <span className="text-lg font-display font-bold text-sidebar-foreground tracking-tight">CRM Pro</span>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] text-sidebar-muted font-semibold mb-1">Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] text-sidebar-muted font-semibold mb-1">Configurações</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && (
          <div className="mb-2 px-2">
            <p className="text-xs text-sidebar-muted truncate">{user?.email}</p>
            <p className="text-[11px] font-semibold text-sidebar-primary capitalize">{role}</p>
          </div>
        )}
        <Button variant="ghost" size={collapsed ? 'icon' : 'sm'} className="w-full text-sidebar-foreground hover:bg-sidebar-accent rounded-lg text-[13px]" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
