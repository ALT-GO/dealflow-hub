import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type FunnelStage = {
  id: string;
  key: string;
  label: string;
  color: string;
  sort_order: number;
  is_system: boolean;
  stage_type: 'active' | 'won' | 'lost';
};

export function useFunnelStages() {
  return useQuery({
    queryKey: ['funnel-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnel_stages')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as FunnelStage[];
    },
  });
}
