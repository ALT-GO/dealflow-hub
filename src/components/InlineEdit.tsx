import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Pencil } from 'lucide-react';

type Props = {
  value: string;
  onSave: (newValue: string) => Promise<void> | void;
  className?: string;
  inputClassName?: string;
  icon?: React.ReactNode;
};

export function InlineEdit({ value, onSave, className, inputClassName, icon }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, value]);

  const handleBlur = async () => {
    const trimmed = draft.trim();
    if (trimmed !== value) {
      setSaving(true);
      await onSave(trimmed);
      setSaving(false);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setDraft(value);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={saving}
        className={cn(
          'h-7 text-sm px-2 py-1 border-primary/40 focus-visible:ring-1 focus-visible:ring-primary/30',
          inputClassName
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-1 cursor-pointer rounded-md px-1 -mx-1 py-0.5 transition-colors hover:bg-muted/60',
        className
      )}
      onClick={() => setEditing(true)}
      title="Clique para editar"
    >
      {icon}
      <span className="font-medium text-foreground">{value || '-'}</span>
      <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors ml-auto shrink-0" />
    </div>
  );
}
