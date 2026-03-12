import { useState, useMemo } from 'react';
import { format, parseISO, addDays, isSameDay, isWeekend, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBudgetTeamMembers } from '@/hooks/useBudgetTeamMembers';

interface SmartDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  onEstimatorSelected?: (estimatorId: string, estimatorName: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

type EstimatorProfile = { user_id: string; full_name: string | null };

type DealSpan = {
  orcamentista_id: string;
  start: Date;
  end: Date;
};

/** Fetch all orçamentistas and their deal spans via SECURITY DEFINER function (works for unauthenticated users too) */
function useGlobalEstimatorAvailability() {
  const { data, isLoading } = useQuery<{ estimators: EstimatorProfile[]; dealSpans: DealSpan[] }>({
    queryKey: ['estimator-availability-rpc'],
    queryFn: async () => {
      const { data: result, error } = await supabase.rpc('get_estimator_availability');
      if (error || !result) return { estimators: [], dealSpans: [] };
      const raw = result as any;
      const estimators: EstimatorProfile[] = raw.estimators || [];
      const spans: DealSpan[] = [];
      for (const deal of (raw.deals || [])) {
        const start = deal.budget_start_date
          ? parseISO(deal.budget_start_date)
          : parseISO(deal.created_at);
        const end = deal.proposal_delivery_date
          ? parseISO(deal.proposal_delivery_date)
          : deal.target_delivery_date
            ? parseISO(deal.target_delivery_date)
            : deal.close_date
              ? parseISO(deal.close_date)
              : addDays(start, 14);
        spans.push({ orcamentista_id: deal.orcamentista_id, start: startOfDay(start), end: startOfDay(end) });
      }
      return { estimators, dealSpans: spans };
    },
    staleTime: 30000,
  });

  return { estimators: data?.estimators || [], dealSpans: data?.dealSpans || [], isLoading };
}

/** For a given date, count how many concurrent deals each estimator has */
function getEstimatorLoadsForDate(
  date: Date,
  dealSpans: DealSpan[],
  estimatorIds: string[],
): { busyEstimators: Set<string>; freeEstimators: string[] } {
  const busyEstimators = new Set<string>();
  const countByEstimator: Record<string, number> = {};

  for (const span of dealSpans) {
    if (!isBefore(date, span.start) && !isBefore(span.end, date)) {
      countByEstimator[span.orcamentista_id] = (countByEstimator[span.orcamentista_id] || 0) + 1;
    }
  }

  for (const eid of estimatorIds) {
    if ((countByEstimator[eid] || 0) >= 1) {
      busyEstimators.add(eid);
    }
  }

  const freeEstimators = estimatorIds.filter(eid => !busyEstimators.has(eid));
  return { busyEstimators, freeEstimators };
}

export function SmartDatePicker({ value, onChange, onEstimatorSelected, placeholder = 'Selecionar data', className, disabled }: SmartDatePickerProps) {
  const date = value ? parseISO(value) : undefined;
  const { estimators, dealSpans } = useGlobalEstimatorAvailability();
  const today = useMemo(() => startOfDay(new Date()), []);
  const estimatorIds = useMemo(() => estimators.map(e => e.user_id), [estimators]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(date);

  const hasEstimators = estimators.length > 0;

  const isDateFullyBooked = (d: Date) => {
    if (!hasEstimators) return false;
    if (isBefore(d, today) || isWeekend(d)) return false; // handled separately
    const { freeEstimators } = getEstimatorLoadsForDate(d, dealSpans, estimatorIds);
    return freeEstimators.length === 0;
  };

  const isDateDisabled = (d: Date) => {
    if (isBefore(d, today)) return true;
    if (isWeekend(d)) return true;
    if (hasEstimators && isDateFullyBooked(d)) return true;
    return false;
  };

  // Get free estimators for the currently selected date
  const freeEstimatorNames = useMemo(() => {
    if (!selectedDate || !hasEstimators) return [];
    const { freeEstimators } = getEstimatorLoadsForDate(selectedDate, dealSpans, estimatorIds);
    return freeEstimators
      .map(eid => estimators.find(e => e.user_id === eid)?.full_name || 'Sem nome')
      .sort();
  }, [selectedDate, dealSpans, estimatorIds, estimators, hasEstimators]);

  // Track last assigned index for round-robin
  const lastAssignedIndexRef = useMemo(() => ({ current: -1 }), []);

  const handleSelect = (d: Date | undefined) => {
    setSelectedDate(d);
    onChange(d ? format(d, 'yyyy-MM-dd') : '');

    // Auto-assign estimator round-robin alphabetically
    if (d && hasEstimators && onEstimatorSelected) {
      const { freeEstimators } = getEstimatorLoadsForDate(d, dealSpans, estimatorIds);
      if (freeEstimators.length > 0) {
        const freeWithNames = freeEstimators
          .map(eid => ({ id: eid, name: estimators.find(e => e.user_id === eid)?.full_name || 'Sem nome' }))
          .sort((a, b) => a.name.localeCompare(b.name));
        const nextIndex = (lastAssignedIndexRef.current + 1) % freeWithNames.length;
        lastAssignedIndexRef.current = nextIndex;
        const selected = freeWithNames[nextIndex];
        onEstimatorSelected(selected.id, selected.name);
      }
    }
  };

  return (
    <div className="space-y-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              'w-full justify-start text-left font-normal h-10',
              !value && 'text-muted-foreground',
              className,
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, 'dd/MM/yyyy') : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <TooltipProvider>
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleSelect}
              locale={ptBR}
              disabled={isDateDisabled}
              modifiers={hasEstimators ? {
                available: (d: Date) => !isDateDisabled(d) && !isBefore(d, today),
                fullyBooked: (d: Date) => !isBefore(d, today) && !isWeekend(d) && isDateFullyBooked(d),
              } : {}}
              modifiersClassNames={hasEstimators ? {
                available: 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
                fullyBooked: 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed',
              } : {}}
              className={cn('p-3 pointer-events-auto')}
            />
          </TooltipProvider>
          {hasEstimators && (
            <div className="px-3 pb-3 flex items-center gap-3 text-[10px] text-muted-foreground border-t border-border pt-2">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />Disponível</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-muted border border-border" />Indisponível</span>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Dynamic helper text showing who is available */}
      {selectedDate && freeEstimatorNames.length > 0 && (
        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
          Disponível: {freeEstimatorNames.join(', ')}
        </p>
      )}
      {selectedDate && hasEstimators && freeEstimatorNames.length === 0 && (
        <p className="text-[11px] text-destructive font-medium">
          Nenhum orçamentista disponível nesta data.
        </p>
      )}
    </div>
  );
}
