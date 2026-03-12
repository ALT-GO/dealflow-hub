import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { KanbanBoard } from '@/components/KanbanBoard';
import { NewDealModal } from '@/components/NewDealModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, Briefcase, DollarSign, LayoutGrid, GanttChart } from 'lucide-react';
import { AdvancedFilters, type Filters } from '@/components/AdvancedFilters';
import { Button } from '@/components/ui/button';
import EstimatorGantt from '@/components/EstimatorGantt';

type ViewMode = 'kanban' | 'gantt';

export default function Dashboard() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<Filters>({});
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');

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

  const { data: dealMetrics } = useQuery({
    queryKey: ['deal-metrics'],
    queryFn: async () => {
      const { data: deals } = await supabase.from('deals').select('value, stage');
      const { data: stages } = await supabase.from('funnel_stages').select('key, stage_type');
      if (!deals || !stages) return null;

      const closedKeys = stages.filter(s => s.stage_type === 'won').map(s => s.key);
      const lostKeys = stages.filter(s => s.stage_type === 'lost').map(s => s.key);

      const all = deals;
      const open = deals.filter(d => !closedKeys.includes(d.stage) && !lostKeys.includes(d.stage));
      const closed = deals.filter(d => closedKeys.includes(d.stage));

      const sum = (arr: typeof deals) => arr.reduce((s, d) => s + (d.value || 0), 0);
      const avg = (arr: typeof deals) => arr.length ? sum(arr) / arr.length : 0;

      // Valor ponderado: peso por posição no funil (simplificado)
      const activeStages = stages
        .filter(s => s.stage_type === 'normal')
        .sort((a, b) => a.key.localeCompare(b.key));
      const totalStages = activeStages.length || 1;
      const stageWeights: Record<string, number> = {};
      activeStages.forEach((s, i) => { stageWeights[s.key] = (i + 1) / totalStages; });
      closedKeys.forEach(k => { stageWeights[k] = 1; });

      const weighted = deals
        .filter(d => !lostKeys.includes(d.stage))
        .reduce((s, d) => s + (d.value || 0) * (stageWeights[d.stage] || 0.5), 0);

      return {
        total: sum(all), totalAvg: avg(all), count: all.length,
        weighted, weightedAvg: all.length ? weighted / all.filter(d => !lostKeys.includes(d.stage)).length : 0,
        open: sum(open), openAvg: avg(open),
        closed: sum(closed), closedAvg: avg(closed),
      };
    },
  });

  const formatCompact = (val: number) => {
    if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
    if (val >= 1_000) return `R$ ${(val / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mil`;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Negócios</h1>
          <p className="text-muted-foreground text-sm">Pipeline de vendas e negócios em andamento</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3 text-xs gap-1.5 rounded-md"
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Kanban
            </Button>
            <Button
              variant={viewMode === 'gantt' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3 text-xs gap-1.5 rounded-md"
              onClick={() => setViewMode('gantt')}
            >
              <GanttChart className="h-3.5 w-3.5" />
              Visão Gantt
            </Button>
          </div>
          <NewDealModal />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <AdvancedFilters
          entityType="deals"
          filters={filters}
          onFiltersChange={setFilters}
        />
        <div className="mt-4">
          {viewMode === 'kanban' ? (
            <KanbanBoard filters={filters} />
          ) : (
            <EstimatorGantt />
          )}
        </div>
      </div>
    </div>
  );
}
