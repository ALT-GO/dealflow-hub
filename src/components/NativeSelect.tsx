import { cn } from '@/lib/utils';

interface NativeSelectOption {
  value: string;
  label: string;
  detail?: string;
}

interface NativeSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: NativeSelectOption[];
  placeholder?: string;
  className?: string;
}

export function NativeSelect({ value, onChange, options, placeholder, className }: NativeSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        !value && "text-muted-foreground",
        className
      )}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}{o.detail ? ` ${o.detail}` : ''}
        </option>
      ))}
    </select>
  );
}
