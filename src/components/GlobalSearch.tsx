import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { storage } from '@/lib/storage';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { Briefcase, Building2, User, FileText, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  type: 'deal' | 'company' | 'contact' | 'file';
  route?: string;
  storagePath?: string;
}

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  // Search logic
  const search = useCallback(async (term: string) => {
    if (!term || term.length < 2 || !user) {
      setResults([]);
      return;
    }

    setLoading(true);
    const like = `%${term}%`;

    const [dealsRes, companiesRes, contactsRes, filesRes] = await Promise.all([
      supabase
        .from('deals')
        .select('id, name, proposal_id')
        .or(`name.ilike.${like},proposal_id.ilike.${like}`)
        .limit(6),
      supabase
        .from('companies')
        .select('id, name')
        .ilike('name', like)
        .limit(6),
      supabase
        .from('contacts')
        .select('id, name, email')
        .or(`name.ilike.${like},email.ilike.${like}`)
        .limit(6),
      supabase
        .from('file_attachments')
        .select('id, file_name, storage_path, entity_type, entity_id')
        .ilike('file_name', like)
        .limit(6),
    ]);

    const items: SearchResult[] = [];

    (dealsRes.data || []).forEach(d => {
      items.push({
        id: d.id,
        label: d.name,
        sublabel: d.proposal_id || undefined,
        type: 'deal',
        route: `/deals/${d.id}`,
      });
    });

    (companiesRes.data || []).forEach(c => {
      items.push({
        id: c.id,
        label: c.name,
        type: 'company',
        route: `/companies/${c.id}`,
      });
    });

    (contactsRes.data || []).forEach(c => {
      items.push({
        id: c.id,
        label: c.name,
        sublabel: c.email || undefined,
        type: 'contact',
        route: `/contacts/${c.id}`,
      });
    });

    (filesRes.data || []).forEach(f => {
      items.push({
        id: f.id,
        label: f.file_name,
        sublabel: f.entity_type || undefined,
        type: 'file',
        storagePath: f.storage_path,
      });
    });

    setResults(items);
    setLoading(false);
  }, [user]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  const handleSelect = (item: SearchResult) => {
    onOpenChange(false);
    if (item.route) {
      navigate(item.route);
    } else if (item.storagePath) {
      const url = storage.getPublicUrl(item.storagePath);
      window.open(url, '_blank');
    }
  };

  const icons: Record<string, typeof Briefcase> = {
    deal: Briefcase,
    company: Building2,
    contact: User,
    file: FileText,
  };

  const groupLabels: Record<string, string> = {
    deal: 'Negócios',
    company: 'Empresas',
    contact: 'Contatos',
    file: 'Arquivos',
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar negócios, empresas, contatos, arquivos..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && query.length >= 2 && results.length === 0 && (
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        )}

        {!loading && Object.entries(grouped).map(([type, items], gi) => {
          const Icon = icons[type] || FileText;
          return (
            <div key={type}>
              {gi > 0 && <CommandSeparator />}
              <CommandGroup heading={groupLabels[type] || type}>
                {items.map(item => (
                  <CommandItem
                    key={`${item.type}-${item.id}`}
                    value={`${item.label} ${item.sublabel || ''}`}
                    onSelect={() => handleSelect(item)}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-sm">{item.label}</span>
                      {item.sublabel && (
                        <span className="truncate text-xs text-muted-foreground">{item.sublabel}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
