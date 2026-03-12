import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { KanbanBoard } from '@/components/KanbanBoard';
import { NewDealModal } from '@/components/NewDealModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, Briefcase, DollarSign, LayoutGrid, GanttChart, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AdvancedFilters, type Filters } from '@/components/AdvancedFilters';
import { Button } from '@/components/ui/button';
import EstimatorGantt from '@/components/EstimatorGantt';

type ViewMode = 'kanban' | 'gantt';

export default function Dashboard() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<Filters>({});
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');

  // Helper to apply filters to a deals query
  const applyFilters = (query: any, f: Filters) => {
    let q = query;
    if (f.minValue) q = q.gte('value', Number(f.minValue));
    if (f.maxValue) q = q.lte('value', Number(f.maxValue));
    if (f.createdAfter) q = q.gte('created_at', f.createdAfter);
    if (f.createdBefore) q = q.lte('created_at', f.createdBefore);
    if (f.ownerId) q = q.eq('owner_id', f.ownerId);
    return q;
  };

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats', filters],
    queryFn: async () => {
      const dealsQuery = applyFilters(supabase.from('deals').select('value'), filters);
      const { data: dealsData } = await dealsQuery;
      return {
        deals: dealsData?.length || 0,
      };
    },
  });

  const { data: dealMetrics } = useQuery({
    queryKey: ['deal-metrics', filters],
    queryFn: async () => {
      const dealsQuery = applyFilters(supabase.from('deals').select('value, stage'), filters);
      const [{ data: deals }, { data: stages }] = await Promise.all([
        dealsQuery,
        supabase.from('funnel_stages').select('key, stage_type'),
      ]);
      if (!deals || !stages) return null;

      const closedKeys = stages.filter(s => s.stage_type === 'won').map(s => s.key);
      const lostKeys = stages.filter(s => s.stage_type === 'lost').map(s => s.key);

      const all = deals;
      const open = deals.filter(d => !closedKeys.includes(d.stage) && !lostKeys.includes(d.stage));
      const closed = deals.filter(d => closedKeys.includes(d.stage));

      const sum = (arr: typeof deals) => arr.reduce((s, d) => s + (d.value || 0), 0);
      const avg = (arr: typeof deals) => arr.length ? sum(arr) / arr.length : 0;

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground">Negócios</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">Pipeline de vendas e negócios em andamento</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-2 sm:px-3 text-xs gap-1 sm:gap-1.5 rounded-md"
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Kanban</span>
            </Button>
            <Button
              variant={viewMode === 'gantt' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-2 sm:px-3 text-xs gap-1 sm:gap-1.5 rounded-md"
              onClick={() => setViewMode('gantt')}
            >
              <GanttChart className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Visão Gantt</span>
            </Button>
          </div>
          <NewDealModal />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { title: 'Negócios', value: String(stats?.deals || 0), avg: null, icon: Briefcase, tip: 'Quantidade total de negócios no pipeline' },
          { title: 'Valor Total', value: formatCompact(dealMetrics?.total || 0), avg: dealMetrics?.totalAvg, icon: DollarSign, tip: 'Soma do valor de todos os negócios, independente do estágio' },
          { title: 'Valor Ponderado', value: formatCompact(dealMetrics?.weighted || 0), avg: dealMetrics?.weightedAvg, icon: DollarSign, tip: 'Valor ajustado pela probabilidade de fechamento baseado na posição no funil' },
          { title: 'Valor Aberto', value: formatCompact(dealMetrics?.open || 0), avg: dealMetrics?.openAvg, icon: DollarSign, tip: 'Soma do valor dos negócios que ainda estão em andamento no pipeline' },
          { title: 'Valor Fechado', value: formatCompact(dealMetrics?.closed || 0), avg: dealMetrics?.closedAvg, icon: DollarSign, tip: 'Soma do valor dos negócios que foram ganhos' },
        ].map((m) => (
          <Card key={m.title} className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{m.title}</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px] text-xs">
                    {m.tip}
                  </TooltipContent>
                </Tooltip>
              </div>
              <m.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-xl font-bold text-primary">{m.value}</p>
              {m.avg != null && (
                <p className="text-xs text-muted-foreground mt-1">
                  Média por negócio<br />
                  <span className="font-medium">{formatCompact(m.avg || 0)}</span>
                </p>
              )}
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
