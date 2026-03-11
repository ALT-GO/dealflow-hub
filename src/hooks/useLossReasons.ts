import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type LossReason = {
  id: string;
  value: string;
  label: string;
  sort_order: number;
};

export function useLossReasons() {
  return useQuery({
    queryKey: ['loss-reasons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loss_reasons')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as LossReason[];
    },
  });
}
