import { useMemo } from 'react';
import { format, parseISO, addDays, isSameDay, isWeekend, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SmartDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  estimatorId?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/** Returns dates where the given estimator has active deal deadlines */
function useEstimatorBusyDates(estimatorId?: string) {
  return useQuery({
    queryKey: ['estimator-busy-dates', estimatorId],
    queryFn: async () => {
      if (!estimatorId) return { busyDates: [] as Date[], dealsByDate: {} as Record<string, number> };
      const { data } = await supabase
        .from('deals')
        .select('id, budget_start_date, proposal_delivery_date, target_delivery_date, close_date, created_at, stage')
        .eq('orcamentista_id', estimatorId);

      const dealsByDate: Record<string, number> = {};
      const busyDates: Date[] = [];

      for (const deal of (data || []) as any[]) {
        if (['fechado', 'perdido', '__won__', '__lost__'].includes(deal.stage)) continue;
        const start = deal.budget_start_date ? parseISO(deal.budget_start_date) : parseISO(deal.created_at);
        const end = deal.proposal_delivery_date
          ? parseISO(deal.proposal_delivery_date)
          : deal.target_delivery_date
            ? parseISO(deal.target_delivery_date)
            : deal.close_date
              ? parseISO(deal.close_date)
              : addDays(start, 14);

        let cursor = startOfDay(start);
        const endDay = startOfDay(end);
        while (isBefore(cursor, addDays(endDay, 1))) {
          const key = format(cursor, 'yyyy-MM-dd');
          dealsByDate[key] = (dealsByDate[key] || 0) + 1;
          cursor = addDays(cursor, 1);
        }
      }

      // Dates with 3+ concurrent deals are "busy"
      for (const [dateStr, count] of Object.entries(dealsByDate)) {
        if (count >= 3) busyDates.push(parseISO(dateStr));
      }

      return { busyDates, dealsByDate };
    },
    enabled: !!estimatorId,
    staleTime: 30000,
  });
}

export function SmartDatePicker({ value, onChange, estimatorId, placeholder = 'Selecionar data', className, disabled }: SmartDatePickerProps) {
  const date = value ? parseISO(value) : undefined;
  const { data: busyData } = useEstimatorBusyDates(estimatorId);
  const busyDates = busyData?.busyDates || [];
  const dealsByDate = busyData?.dealsByDate || {};
  const today = useMemo(() => startOfDay(new Date()), []);

  const isDateBusy = (d: Date) => busyDates.some(b => isSameDay(b, d));
  const isDateDisabled = (d: Date) => {
    if (isBefore(d, today)) return true;
    if (isWeekend(d)) return true;
    if (estimatorId && isDateBusy(d)) return true;
    return false;
  };

  return (
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
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => onChange(d ? format(d, 'yyyy-MM-dd') : '')}
          locale={ptBR}
          disabled={isDateDisabled}
          modifiers={estimatorId ? {
            available: (d: Date) => !isDateDisabled(d) && !isBefore(d, today),
            light: (d: Date) => {
              const key = format(d, 'yyyy-MM-dd');
              return !!dealsByDate[key] && (dealsByDate[key] || 0) < 3 && !isBefore(d, today) && !isWeekend(d);
            },
          } : {}}
          modifiersClassNames={estimatorId ? {
            available: 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
            light: 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
          } : {}}
          className={cn('p-3 pointer-events-auto')}
        />
        {estimatorId && (
          <div className="px-3 pb-3 flex items-center gap-3 text-[10px] text-muted-foreground border-t border-border pt-2">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />Disponível</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />Parcial</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-muted" />Indisponível</span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
