import { LayoutDashboard, Building2, Users, LogOut, Settings, Zap, UsersRound } from 'lucide-react';
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
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Empresas', url: '/companies', icon: Building2 },
  { title: 'Contatos', url: '/contacts', icon: Users },
];

const settingsItems = [
  { title: 'Propriedades', url: '/settings/properties', icon: Settings },
  { title: 'Automações', url: '/settings/automations', icon: Zap },
  { title: 'Equipe', url: '/settings/team', icon: UsersRound },
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

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={`px-4 py-5 ${collapsed ? 'px-2' : ''}`}>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sidebar-primary shadow-md">
              <Building2 className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
            {!collapsed && (
              <span className="text-lg font-display font-bold text-sidebar-foreground">CRM Pro</span>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-widest text-sidebar-muted font-semibold">Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === '/'}
                        className="rounded-lg transition-all duration-200 hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold shadow-sm"
                      >
                        <item.icon
                          className="mr-2 h-4 w-4 transition-all duration-200"
                          fill={active ? 'currentColor' : 'none'}
                          strokeWidth={active ? 1.5 : 2}
                        />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-widest text-sidebar-muted font-semibold">Configurações</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="rounded-lg transition-all duration-200 hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold shadow-sm"
                      >
                        <item.icon
                          className="mr-2 h-4 w-4 transition-all duration-200"
                          fill={active ? 'currentColor' : 'none'}
                          strokeWidth={active ? 1.5 : 2}
                        />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && (
          <div className="mb-2 px-2">
            <p className="text-xs text-sidebar-muted truncate">{user?.email}</p>
            <p className="text-xs font-semibold text-sidebar-primary capitalize">{role}</p>
          </div>
        )}
        <Button variant="ghost" size={collapsed ? 'icon' : 'sm'} className="w-full text-sidebar-foreground hover:bg-sidebar-accent rounded-lg" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
