import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CustomProperty = {
  id: string;
  entity_type: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  default_value: string | null;
  dropdown_options: string[] | null;
  sort_order: number;
};

export function useCustomProperties(entityType: string) {
  return useQuery({
    queryKey: ['custom-properties', entityType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_properties')
        .select('*')
        .eq('entity_type', entityType)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as CustomProperty[];
    },
  });
}

export function useCustomPropertyValues(entityId: string | undefined) {
  return useQuery({
    queryKey: ['custom-property-values', entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_property_values')
        .select('property_id, value')
        .eq('entity_id', entityId!);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((v) => { if (v.value) map[v.property_id] = v.value; });
      return map;
    },
    enabled: !!entityId,
  });
}
