import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { format, addDays, startOfWeek, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface EstimatorGanttProps {
  mini?: boolean;
}

type GanttDeal = {
  id: string;
  name: string;
  proposal_id: string | null;
  owner_id: string;
  orcamentista_id: string | null;
  budget_start_date: string | null;
  proposal_delivery_date: string | null;
  target_delivery_date: string | null;
  created_at: string;
  close_date: string | null;
  stage: string;
  value: number | null;
};

// Consistent color palette for estimators - high contrast, distinguishable
const ESTIMATOR_PALETTE = [
  'hsl(220 70% 55%)',   // Blue
  'hsl(340 65% 50%)',   // Rose
  'hsl(150 55% 42%)',   // Green
  'hsl(38 85% 50%)',    // Amber
  'hsl(260 55% 55%)',   // Purple
  'hsl(190 60% 45%)',   // Teal
  'hsl(15 75% 52%)',    // Orange
  'hsl(280 50% 55%)',   // Violet
  'hsl(170 50% 42%)',   // Cyan
  'hsl(0 65% 52%)',     // Red
  'hsl(80 50% 42%)',    // Olive
  'hsl(310 50% 55%)',   // Magenta
];

export default function EstimatorGantt({ mini = false }: EstimatorGanttProps) {
  const { user, role } = useAuth();
  const { data: funnelStages = [] } = useFunnelStages();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const totalDays = mini ? 21 : 56;
  const today = useMemo(() => new Date(), []);
  const startDate = useMemo(() => addDays(startOfWeek(today, { weekStartsOn: 1 }), -7), [today]);
  const days = useMemo(() => Array.from({ length: totalDays }, (_, i) => addDays(startDate, i)), [startDate, totalDays]);

  const { data: userTeamIds = [] } = useQuery({
    queryKey: ['user-teams', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from('team_members').select('team_id').eq('user_id', user.id);
      return (data || []).map(t => t.team_id);
    },
    enabled: !!user && role === 'gerencia',
  });

  const { data: allUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['gantt-users', role, user?.id, userTeamIds],
    queryFn: async () => {
      if (!user) return [];
      if (role === 'vendedor' || role === 'orcamentista') {
        const { data } = await supabase.from('profiles').select('user_id, full_name').eq('user_id', user.id);
        return data || [];
      }
      if (role === 'admin') {
        const { data } = await supabase.from('profiles').select('user_id, full_name');
        return data || [];
      }
      if (role === 'gerencia' && userTeamIds.length > 0) {
        const { data: members } = await supabase.from('team_members').select('user_id').in('team_id', userTeamIds);
        const memberIds = [...new Set((members || []).map(m => m.user_id))];
        if (memberIds.length === 0) return [];
        const { data } = await supabase.from('profiles').select('user_id, full_name').in('user_id', memberIds);
        return data || [];
      }
      return [];
    },
    enabled: !!user,
  });

  const { data: deals = [], isLoading: loadingDeals } = useQuery<GanttDeal[]>({
    queryKey: ['gantt-deals'],
    queryFn: async () => {
      const { data } = await supabase
        .from('deals')
        .select('id, name, proposal_id, owner_id, orcamentista_id, budget_start_date, proposal_delivery_date, target_delivery_date, created_at, close_date, stage, value');
      return (data || []) as GanttDeal[];
    },
  });

  const isLoading = loadingUsers || loadingDeals;

  // Build a stable color map: sorted user IDs → palette index
  const userColorMap = useMemo(() => {
    const sortedIds = [...allUsers].map(u => u.user_id).sort();
    const map: Record<string, string> = {};
    sortedIds.forEach((id, idx) => {
      map[id] = ESTIMATOR_PALETTE[idx % ESTIMATOR_PALETTE.length];
    });
    return map;
  }, [allUsers]);

  const getDealsForUser = (userId: string) =>
    deals.filter(d => (d.orcamentista_id === userId || d.owner_id === userId) &&
      !['fechado', 'perdido', '__won__', '__lost__'].includes(d.stage));

  const getDealSpan = (deal: GanttDeal) => {
    const dealStart = deal.budget_start_date ? parseISO(deal.budget_start_date) : parseISO(deal.created_at);
    const dealEnd = deal.proposal_delivery_date
      ? parseISO(deal.proposal_delivery_date)
      : deal.target_delivery_date
        ? parseISO(deal.target_delivery_date)
        : deal.close_date
          ? parseISO(deal.close_date)
          : addDays(dealStart, 14);
    return { start: dealStart, end: dealEnd };
  };

  const todayOffset = differenceInDays(today, startDate);

  const weekLabels = useMemo(() => {
    const labels: { label: string; span: number; startIdx: number }[] = [];
    let i = 0;
    while (i < days.length) {
      const weekStart = startOfWeek(days[i], { weekStartsOn: 1 });
      const label = format(weekStart, "'Sem' dd/MM", { locale: ptBR });
      let span = 0;
      while (i + span < days.length && differenceInDays(days[i + span], weekStart) < 7 && differenceInDays(days[i + span], weekStart) >= 0) {
        span++;
      }
      labels.push({ label, span, startIdx: i });
      i += span;
    }
    return labels;
  }, [days]);

  const formatCurrency = (val: number | null) =>
    val != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : '';

  const toggleUser = (userId: string) =>
    setCollapsed(prev => ({ ...prev, [userId]: !prev[userId] }));

  if (isLoading) {
    return <div className="space-y-2 p-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>;
  }

  if (!allUsers.length) {
    return <p className="text-sm text-muted-foreground p-4">Nenhum membro encontrado para exibir.</p>;
  }

  const nameColWidth = mini ? 'w-32 min-w-32' : 'w-52 min-w-52';
  const ROW_H = mini ? 24 : 32;

  return (
    <TooltipProvider>
      <div className={`overflow-x-auto rounded-xl border border-border bg-card ${mini ? 'max-h-72' : ''}`}>
        {/* Estimator color legend */}
        {!mini && allUsers.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/20 flex-wrap">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Orçamentistas:</span>
            {allUsers.map(u => (
              <span key={u.user_id} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: userColorMap[u.user_id] || ESTIMATOR_PALETTE[0] }} />
                {u.full_name || 'Sem nome'}
              </span>
            ))}
          </div>
        )}

        <div className="min-w-[800px]">
          {/* Week header */}
          {!mini && (
            <div className="flex border-b border-border bg-muted/30">
              <div className={`${nameColWidth} p-2 border-r border-border flex-shrink-0`} />
              <div className="flex flex-1">
                {weekLabels.map((wk, idx) => (
                  <div key={idx} className="text-[10px] font-semibold text-muted-foreground text-center border-r border-border py-1.5" style={{ flex: wk.span }}>
                    {wk.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Day header */}
          <div className="flex border-b border-border sticky top-0 bg-card z-10">
            <div className={`${nameColWidth} p-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-r border-border flex-shrink-0`}>
              Orçamentista / Negócio
            </div>
            <div className="flex flex-1">
              {days.map((day, i) => {
                const isToday = differenceInDays(day, today) === 0;
                const isWkend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <div key={i} className={`flex-1 min-w-5 text-center text-[9px] py-1.5 border-r border-border last:border-r-0 ${isToday ? 'bg-primary/15 font-bold text-primary' : isWkend ? 'bg-muted/40 text-muted-foreground/60' : 'text-muted-foreground'}`}>
                    <div>{format(day, 'EEE', { locale: ptBR }).charAt(0).toUpperCase()}</div>
                    <div className="font-semibold">{format(day, 'd')}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* User groups */}
          {allUsers.map((usr) => {
            const userDeals = getDealsForUser(usr.user_id);
            const isCollapsed = collapsed[usr.user_id] ?? false;
            const userColor = userColorMap[usr.user_id] || ESTIMATOR_PALETTE[0];

            return (
              <div key={usr.user_id}>
                {/* User header row */}
                <div
                  className="flex border-b border-border bg-muted/10 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => toggleUser(usr.user_id)}
                >
                  <div className={`${nameColWidth} px-2 py-1.5 text-xs font-semibold border-r border-border flex-shrink-0 flex items-center gap-1.5`}>
                    {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: userColor }} />
                    <span className="truncate text-foreground">{usr.full_name || 'Sem nome'}</span>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 shrink-0 ml-auto">
                      {userDeals.length}
                    </Badge>
                  </div>
                  <div className="flex flex-1 relative" style={{ height: ROW_H }}>
                    {days.map((day, i) => {
                      const isWkend = day.getDay() === 0 || day.getDay() === 6;
                      return <div key={i} className={`flex-1 min-w-5 border-r border-border/30 last:border-r-0 ${isWkend ? 'bg-muted/20' : ''}`} />;
                    })}
                    {todayOffset >= 0 && todayOffset < totalDays && (
                      <div className="absolute top-0 bottom-0 w-[2px] bg-primary z-20 pointer-events-none" style={{ left: `${((todayOffset + 0.5) / totalDays) * 100}%` }} />
                    )}
                  </div>
                </div>

                {/* Deal rows */}
                {!isCollapsed && userDeals.map((deal) => {
                  const { start, end } = getDealSpan(deal);
                  const startOffset = Math.max(0, differenceInDays(start, startDate));
                  const endOffset = Math.min(totalDays - 1, differenceInDays(end, startDate));
                  const visible = endOffset >= 0 && startOffset < totalDays;
                  const leftPct = (startOffset / totalDays) * 100;
                  const widthPct = ((endOffset - startOffset + 1) / totalDays) * 100;
                  const stageLabel = funnelStages.find(s => s.key === deal.stage)?.label || deal.stage;

                  return (
                    <div key={deal.id} className="flex border-b border-border/50 hover:bg-muted/10 transition-colors">
                      <div className={`${nameColWidth} px-2 py-0.5 text-[11px] border-r border-border flex-shrink-0 flex items-center gap-1.5 pl-7`}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: userColor }} />
                        <span className="truncate text-muted-foreground">{deal.proposal_id || deal.name}</span>
                      </div>
                      <div className="flex flex-1 relative" style={{ height: ROW_H }}>
                        {days.map((day, i) => {
                          const isWkend = day.getDay() === 0 || day.getDay() === 6;
                          return <div key={i} className={`flex-1 min-w-5 border-r border-border/30 last:border-r-0 ${isWkend ? 'bg-muted/10' : ''}`} />;
                        })}
                        {todayOffset >= 0 && todayOffset < totalDays && (
                          <div className="absolute top-0 bottom-0 w-[2px] bg-primary/40 z-20 pointer-events-none" style={{ left: `${((todayOffset + 0.5) / totalDays) * 100}%` }} />
                        )}
                        {visible && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute rounded cursor-pointer hover:brightness-110 transition-all shadow-sm"
                                style={{
                                  left: `${leftPct}%`,
                                  width: `${Math.max(widthPct, 1.5)}%`,
                                  top: 4,
                                  height: ROW_H - 8,
                                  backgroundColor: userColor,
                                }}
                              >
                                {widthPct > 6 && (
                                  <span className="text-[10px] px-1.5 truncate block text-white font-medium drop-shadow-sm" style={{ lineHeight: `${ROW_H - 8}px` }}>
                                    {deal.proposal_id || deal.name}
                                  </span>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="font-semibold text-sm">{deal.proposal_id || deal.name}</p>
                              <p className="text-xs text-muted-foreground">{stageLabel}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(start, 'dd/MM/yyyy')} — {format(end, 'dd/MM/yyyy')}
                              </p>
                              {deal.value != null && deal.value > 0 && (
                                <p className="text-xs font-semibold text-primary mt-0.5">{formatCurrency(deal.value)}</p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Empty state */}
                {!isCollapsed && userDeals.length === 0 && (
                  <div className="flex border-b border-border/50">
                    <div className={`${nameColWidth} px-2 py-1 text-[11px] text-muted-foreground/50 border-r border-border flex-shrink-0 pl-7`}>
                      Sem negócios ativos
                    </div>
                    <div className="flex flex-1" style={{ height: ROW_H }}>
                      {days.map((_, i) => <div key={i} className="flex-1 min-w-5 border-r border-border/30 last:border-r-0" />)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}

/** Hook to get active deal counts per user for availability indicators */
export function useEstimatorWorkload() {
  return useQuery({
    queryKey: ['estimator-workload'],
    queryFn: async () => {
      const { data: deals } = await supabase
        .from('deals')
        .select('orcamentista_id, stage')
        .not('orcamentista_id', 'is', null);
      const counts: Record<string, number> = {};
      for (const d of (deals || []) as any[]) {
        if (['fechado', 'perdido', '__won__', '__lost__'].includes(d.stage)) continue;
        counts[d.orcamentista_id] = (counts[d.orcamentista_id] || 0) + 1;
      }
      return counts;
    },
    staleTime: 30000,
  });
}
