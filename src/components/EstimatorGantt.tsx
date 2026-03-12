import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, addDays, startOfWeek, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface EstimatorGanttProps {
  mini?: boolean;
}

const DEAL_COLORS = [
  'hsl(190 35% 50% / 0.7)',
  'hsl(150 40% 45% / 0.7)',
  'hsl(38 85% 50% / 0.65)',
  'hsl(260 40% 55% / 0.6)',
  'hsl(340 50% 50% / 0.6)',
];

export default function EstimatorGantt({ mini = false }: EstimatorGanttProps) {
  const { user, role } = useAuth();
  const totalDays = mini ? 21 : 56;
  const today = useMemo(() => new Date(), []);
  const startDate = useMemo(() => addDays(startOfWeek(today, { weekStartsOn: 1 }), -7), [today]);
  const days = useMemo(() => Array.from({ length: totalDays }, (_, i) => addDays(startDate, i)), [startDate, totalDays]);

  // Fetch user's team membership for gerência filtering
  const { data: userTeamIds = [] } = useQuery({
    queryKey: ['user-teams', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from('team_members').select('team_id').eq('user_id', user.id);
      return (data || []).map(t => t.team_id);
    },
    enabled: !!user && role === 'gerencia',
  });

  // Fetch all profiles + roles, then filter by role-based visibility
  const { data: allUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['gantt-users', role, user?.id, userTeamIds],
    queryFn: async () => {
      if (!user) return [];

      // Vendedor/Orcamentista: only self
      if (role === 'vendedor' || role === 'orcamentista') {
        const { data } = await supabase.from('profiles').select('user_id, full_name').eq('user_id', user.id);
        return data || [];
      }

      // Admin: all users
      if (role === 'admin') {
        const { data } = await supabase.from('profiles').select('user_id, full_name');
        return data || [];
      }

      // Gerência: users in same team(s)
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

  // Fetch deals with date ranges
  const { data: deals = [], isLoading: loadingDeals } = useQuery({
    queryKey: ['gantt-deals'],
    queryFn: async () => {
      const { data } = await supabase
        .from('deals')
        .select('id, name, proposal_id, owner_id, orcamentista_id, budget_start_date, proposal_delivery_date, target_delivery_date, created_at, close_date, stage, value');
      return (data || []) as any[];
    },
  });

  const isLoading = loadingUsers || loadingDeals;
  const userIds = allUsers.map(u => u.user_id);

  const getDealsForUser = (userId: string) =>
    deals.filter(d => d.owner_id === userId || d.orcamentista_id === userId);

  const getDealSpan = (deal: any) => {
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

  // Week labels
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

  if (isLoading) {
    return <div className="space-y-2 p-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>;
  }

  if (!allUsers.length) {
    return <p className="text-sm text-muted-foreground p-4">Nenhum membro encontrado para exibir.</p>;
  }

  const nameColWidth = mini ? 'w-28 min-w-28' : 'w-44 min-w-44';

  return (
    <TooltipProvider>
      <div className={`overflow-x-auto rounded-xl border border-border bg-card ${mini ? 'max-h-64' : ''}`}>
        <div className="min-w-[800px]">
          {/* Week header */}
          {!mini && (
            <div className="flex border-b border-border bg-muted/30">
              <div className={`${nameColWidth} p-2 border-r border-border flex-shrink-0`} />
              <div className="flex flex-1">
                {weekLabels.map((wk, idx) => (
                  <div
                    key={idx}
                    className="text-[10px] font-semibold text-muted-foreground text-center border-r border-border py-1.5"
                    style={{ flex: wk.span }}
                  >
                    {wk.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Day header */}
          <div className="flex border-b border-border sticky top-0 bg-card z-10">
            <div className={`${nameColWidth} p-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-r border-border flex-shrink-0`}>
              Membro
            </div>
            <div className="flex flex-1">
              {days.map((day, i) => {
                const isToday = differenceInDays(day, today) === 0;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <div
                    key={i}
                    className={`flex-1 min-w-5 text-center text-[9px] py-1.5 border-r border-border last:border-r-0 ${
                      isToday ? 'bg-primary/15 font-bold text-primary' : isWeekend ? 'bg-muted/40 text-muted-foreground/60' : 'text-muted-foreground'
                    }`}
                  >
                    <div>{format(day, 'EEE', { locale: ptBR }).charAt(0).toUpperCase()}</div>
                    <div className="font-semibold">{format(day, 'd')}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rows */}
          {allUsers.map((usr) => {
            const userDeals = getDealsForUser(usr.user_id);
            const activeCount = userDeals.filter(d => !['fechado', 'perdido', '__won__', '__lost__'].includes(d.stage)).length;

            return (
              <div key={usr.user_id} className="flex border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors group">
                <div className={`${nameColWidth} p-2 text-xs font-medium truncate border-r border-border flex-shrink-0 flex items-center gap-2`}>
                  <span className="truncate">{usr.full_name || 'Sem nome'}</span>
                  {!mini && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                      {activeCount}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-1 relative" style={{ minHeight: mini ? 28 : 40 }}>
                  {/* Grid cells */}
                  {days.map((day, i) => {
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    return (
                      <div key={i} className={`flex-1 min-w-5 border-r border-border/50 last:border-r-0 ${isWeekend ? 'bg-muted/20' : ''}`} />
                    );
                  })}

                  {/* Today marker */}
                  {todayOffset >= 0 && todayOffset < totalDays && (
                    <div
                      className="absolute top-0 bottom-0 w-[2px] bg-primary z-20 pointer-events-none"
                      style={{ left: `${((todayOffset + 0.5) / totalDays) * 100}%` }}
                    />
                  )}

                  {/* Deal blocks - stacked */}
                  {userDeals.map((deal, dIdx) => {
                    const { start, end } = getDealSpan(deal);
                    const startOffset = Math.max(0, differenceInDays(start, startDate));
                    const endOffset = Math.min(totalDays - 1, differenceInDays(end, startDate));
                    if (endOffset < 0 || startOffset >= totalDays) return null;
                    const leftPct = (startOffset / totalDays) * 100;
                    const widthPct = ((endOffset - startOffset + 1) / totalDays) * 100;
                    const color = DEAL_COLORS[dIdx % DEAL_COLORS.length];
                    const rowHeight = mini ? 20 : 28;
                    const topOffset = mini ? 4 : 6;

                    return (
                      <Tooltip key={deal.id}>
                        <TooltipTrigger asChild>
                          <div
                            className="absolute rounded-md cursor-pointer hover:brightness-110 transition-all shadow-sm"
                            style={{
                              left: `${leftPct}%`,
                              width: `${Math.max(widthPct, 1.5)}%`,
                              top: topOffset,
                              height: rowHeight,
                              backgroundColor: color,
                            }}
                          >
                            {!mini && widthPct > 5 && (
                              <span className="text-[10px] px-1.5 truncate block leading-7 text-white font-medium drop-shadow-sm">
                                {deal.proposal_id || deal.name}
                              </span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p className="font-semibold text-sm">{deal.proposal_id || deal.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(start, 'dd/MM/yyyy')} — {format(end, 'dd/MM/yyyy')}
                          </p>
                          {deal.value > 0 && (
                            <p className="text-xs font-semibold text-primary mt-0.5">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value)}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
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
