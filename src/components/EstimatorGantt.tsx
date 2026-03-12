import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, startOfWeek, differenceInDays, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipProvider } from '@/components/ui/tooltip';

interface EstimatorGanttProps {
  mini?: boolean;
}

export default function EstimatorGantt({ mini = false }: EstimatorGanttProps) {
  const totalDays = mini ? 21 : 42;
  const today = useMemo(() => new Date(), []);
  const startDate = useMemo(() => startOfWeek(today, { weekStartsOn: 1 }), [today]);
  const days = useMemo(() => Array.from({ length: totalDays }, (_, i) => addDays(startDate, i)), [startDate, totalDays]);

  // Fetch orcamentistas
  const { data: estimators = [], isLoading: loadingEstimators } = useQuery({
    queryKey: ['estimators-gantt'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'orcamentista');
      if (!roles?.length) return [];
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      return profiles || [];
    },
  });

  // Fetch deals assigned to orcamentistas
  const { data: deals = [], isLoading: loadingDeals } = useQuery({
    queryKey: ['estimator-deals-gantt'],
    queryFn: async () => {
      const { data } = await supabase
        .from('deals')
        .select('id, name, proposal_id, orcamentista_id, budget_start_date, proposal_delivery_date, created_at, close_date, stage, company_id')
        .not('orcamentista_id', 'is', null);
      return (data || []) as any[];
    },
  });

  const isLoading = loadingEstimators || loadingDeals;

  const getDealsForEstimator = (userId: string) => {
    return deals.filter(d => d.orcamentista_id === userId);
  };

  const getDealSpan = (deal: any) => {
    const dealStart = parseISO(deal.created_at);
    const dealEnd = deal.close_date ? parseISO(deal.close_date) : addDays(dealStart, 14); // default 2 weeks
    return { start: dealStart, end: dealEnd };
  };

  const colors = [
    'bg-primary/70', 'bg-accent/70', 'bg-secondary', 
    'hsl(var(--primary) / 0.5)', 'hsl(var(--accent) / 0.6)',
  ];

  if (isLoading) {
    return <div className="space-y-2 p-4"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /></div>;
  }

  if (!estimators.length) {
    return <p className="text-sm text-muted-foreground p-4">Nenhum orçamentista encontrado.</p>;
  }

  return (
    <TooltipProvider>
      <div className={`overflow-x-auto border rounded-lg bg-card ${mini ? 'max-h-64' : ''}`}>
        <div className="min-w-[700px]">
          {/* Header row */}
          <div className="flex border-b sticky top-0 bg-card z-10">
            <div className={`${mini ? 'w-28 min-w-28' : 'w-40 min-w-40'} p-2 text-xs font-semibold text-muted-foreground border-r flex-shrink-0`}>
              Orçamentista
            </div>
            <div className="flex flex-1">
              {days.map((day, i) => {
                const isToday = differenceInDays(day, today) === 0;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <div
                    key={i}
                    className={`flex-1 min-w-6 text-center text-[10px] p-1 border-r ${isToday ? 'bg-primary/20 font-bold text-primary' : isWeekend ? 'bg-muted/50 text-muted-foreground' : 'text-muted-foreground'}`}
                  >
                    {mini ? format(day, 'd', { locale: ptBR }) : format(day, 'dd/MM', { locale: ptBR })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rows */}
          {estimators.map((est, estIdx) => {
            const estDeals = getDealsForEstimator(est.user_id);
            return (
              <div key={est.user_id} className="flex border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                <div className={`${mini ? 'w-28 min-w-28' : 'w-40 min-w-40'} p-2 text-xs font-medium truncate border-r flex-shrink-0 flex items-center`}>
                  {est.full_name || 'Sem nome'}
                </div>
                <div className="flex flex-1 relative" style={{ minHeight: mini ? 28 : 36 }}>
                  {days.map((day, i) => {
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    return (
                      <div key={i} className={`flex-1 min-w-6 border-r ${isWeekend ? 'bg-muted/30' : ''}`} />
                    );
                  })}
                  {/* Deal blocks */}
                  {estDeals.map((deal, dIdx) => {
                    const { start, end } = getDealSpan(deal);
                    const startOffset = Math.max(0, differenceInDays(start, startDate));
                    const endOffset = Math.min(totalDays - 1, differenceInDays(end, startDate));
                    if (endOffset < 0 || startOffset >= totalDays) return null;
                    const leftPct = (Math.max(0, startOffset) / totalDays) * 100;
                    const widthPct = ((Math.min(endOffset, totalDays - 1) - Math.max(0, startOffset) + 1) / totalDays) * 100;
                    const colorClass = ['bg-primary/60', 'bg-accent/60', 'bg-secondary/80'][dIdx % 3];
                    return (
                      <Tooltip key={deal.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={`absolute ${colorClass} rounded-sm cursor-pointer hover:opacity-80 transition-opacity`}
                            style={{
                              left: `${leftPct}%`,
                              width: `${Math.max(widthPct, 2)}%`,
                              top: mini ? 4 : 6,
                              height: mini ? 20 : 24,
                            }}
                          >
                            {!mini && (
                              <span className="text-[10px] px-1 truncate block leading-6 text-foreground font-medium">
                                {deal.proposal_id || deal.name}
                              </span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="font-semibold">{deal.proposal_id || deal.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(start, 'dd/MM/yyyy')} — {format(end, 'dd/MM/yyyy')}
                          </p>
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
