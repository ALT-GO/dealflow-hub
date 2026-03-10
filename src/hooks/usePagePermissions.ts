import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function usePagePermissions() {
  const { role } = useAuth();

  const { data: permissions = [] } = useQuery({
    queryKey: ['page-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('page_permissions')
        .select('page_path, page_label, allowed_roles');
      if (error) throw error;
      return data as { page_path: string; page_label: string; allowed_roles: string[] }[];
    },
  });

  const canAccess = (path: string): boolean => {
    if (!role) return false;
    const perm = permissions.find((p) => p.page_path === path);
    if (!perm) return true; // no restriction = allowed
    return perm.allowed_roles.includes(role);
  };

  return { permissions, canAccess };
}
