import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type BudgetMember = {
  user_id: string;
  full_name: string;
};

export function useBudgetTeamMembers() {
  return useQuery<BudgetMember[]>({
    queryKey: ['budget-team-members'],
    queryFn: async () => {
      // Find the "Orçamentos" team
      const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('name', 'Orçamentos')
        .single();

      if (!team) return [];

      // Get members of that team
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', team.id);

      if (!members || members.length === 0) return [];

      const userIds = members.map(m => m.user_id);

      // Get profiles for those members
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      return (profiles || [])
        .filter(p => p.full_name)
        .map(p => ({ user_id: p.user_id, full_name: p.full_name! }));
    },
  });
}
