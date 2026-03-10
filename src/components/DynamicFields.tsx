import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CustomProperty } from '@/hooks/useCustomProperties';

type Props = {
  properties: CustomProperty[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  readOnly?: boolean;
};

export function DynamicFields({ properties, values, onChange, readOnly }: Props) {
  if (properties.length === 0) return null;

  const setValue = (propId: string, val: string) => {
    onChange({ ...values, [propId]: val });
  };

  return (
    <div className="space-y-3">
      {properties.map((prop) => {
        const val = values[prop.id] || prop.default_value || '';
        return (
          <div key={prop.id} className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {prop.field_label}
              {prop.is_required && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            {readOnly ? (
              <p className="text-sm font-medium text-foreground">{val || '-'}</p>
            ) : (
              <FieldInput prop={prop} value={val} onChange={(v) => setValue(prop.id, v)} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FieldInput({ prop, value, onChange }: { prop: CustomProperty; value: string; onChange: (v: string) => void }) {
  switch (prop.field_type) {
    case 'number':
    case 'currency':
      return (
        <Input
          type="number"
          step={prop.field_type === 'currency' ? '0.01' : '1'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={prop.field_label}
          required={prop.is_required}
        />
      );
    case 'date':
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {value ? format(parseISO(value), 'dd/MM/yyyy') : 'Selecionar data'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value ? parseISO(value) : undefined}
              onSelect={(d) => onChange(d ? format(d, 'yyyy-MM-dd') : '')}
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>
      );
    case 'dropdown': {
      const options = (prop.dropdown_options || []) as string[];
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case 'email':
      return (
        <Input
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={prop.field_label}
          required={prop.is_required}
        />
      );
    default:
      return (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={prop.field_label}
          required={prop.is_required}
        />
      );
  }
}

/** Save custom property values for an entity */
export async function saveCustomPropertyValues(
  entityId: string,
  values: Record<string, string>,
  supabaseClient: typeof import('@/integrations/supabase/client').supabase
) {
  const entries = Object.entries(values).filter(([, v]) => v !== '');
  if (entries.length === 0) return;

  const upserts = entries.map(([property_id, value]) => ({
    entity_id: entityId,
    property_id,
    value,
  }));

  // Upsert each one (no unique constraint on entity_id+property_id, so delete+insert)
  for (const u of upserts) {
    await supabaseClient
      .from('custom_property_values')
      .delete()
      .eq('entity_id', u.entity_id)
      .eq('property_id', u.property_id);
    await supabaseClient.from('custom_property_values').insert(u);
  }
}
