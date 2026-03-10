import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { KanbanBoard } from '@/components/KanbanBoard';
import { NewDealModal } from '@/components/NewDealModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, Briefcase, DollarSign } from 'lucide-react';
import { AdvancedFilters, type Filters } from '@/components/AdvancedFilters';
import { ViewTabs, type ViewTab } from '@/components/ViewTabs';

export default function Dashboard() {
  const [filters, setFilters] = useState<Filters>({});
  const [activeTab, setActiveTab] = useState<ViewTab>('all');

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [companiesRes, contactsRes, dealsRes] = await Promise.all([
        supabase.from('companies').select('id', { count: 'exact', head: true }),
        supabase.from('contacts').select('id', { count: 'exact', head: true }),
        supabase.from('deals').select('value'),
      ]);
      const totalValue = (dealsRes.data || []).reduce((s, d) => s + (d.value || 0), 0);
      return {
        companies: companiesRes.count || 0,
        contacts: contactsRes.count || 0,
        deals: dealsRes.data?.length || 0,
        totalValue,
      };
    },
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const statCards = [
    { title: 'Empresas', value: stats?.companies || 0, icon: Building2 },
    { title: 'Contatos', value: stats?.contacts || 0, icon: Users },
    { title: 'Negócios', value: stats?.deals || 0, icon: Briefcase },
    { title: 'Pipeline Total', value: formatCurrency(stats?.totalValue || 0), icon: DollarSign },
  ];

  const handleTabChange = (tab: ViewTab, tabFilters?: Filters) => {
    setActiveTab(tab);
    if (tabFilters) setFilters(tabFilters);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Visão geral do pipeline de vendas</p>
        </div>
        <NewDealModal />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-card-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-display font-semibold text-foreground mb-4">Pipeline de Negócios</h2>
        <ViewTabs entityType="deals" activeTab={activeTab} onTabChange={handleTabChange} currentFilters={filters} />
        <div className="mt-4">
          <AdvancedFilters
            entityType="deals"
            filters={filters}
            onFiltersChange={setFilters}
            activeViewId={activeTab !== 'all' && activeTab !== 'mine' && activeTab !== 'recent' ? activeTab : undefined}
            onViewSelect={(v) => setActiveTab(v?.id || 'all')}
          />
        </div>
        <div className="mt-4">
          <KanbanBoard filters={filters} />
        </div>
      </div>
    </div>
  );
}
