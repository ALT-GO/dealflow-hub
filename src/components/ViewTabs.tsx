import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import type { Filters } from '@/components/AdvancedFilters';

export type ViewTab = 'all' | 'mine' | 'recent' | string;

type Props = {
  entityType: 'companies' | 'contacts' | 'deals';
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab, filters?: Filters) => void;
  currentFilters: Filters;
};

export function ViewTabs({ entityType, activeTab, onTabChange, currentFilters }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState('');

  const { data: savedViews = [] } = useQuery({
    queryKey: ['saved-views', entityType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_views')
        .select('*')
        .eq('entity_type', entityType)
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });

  const hasActiveFilters = Object.values(currentFilters).some((v) => v && v !== '');

  const handleSave = async () => {
    if (!viewName.trim() || !user) return;
    const { error } = await supabase.from('saved_views').insert({
      name: viewName.trim(),
      entity_type: entityType,
      filters: currentFilters as any,
      user_id: user.id,
    });
    if (error) {
      toast.error('Erro ao salvar visualização');
    } else {
      toast.success('Visualização salva!');
      queryClient.invalidateQueries({ queryKey: ['saved-views', entityType] });
      setSaveOpen(false);
      setViewName('');
    }
  };

  const handleDeleteView = async (viewId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('saved_views').delete().eq('id', viewId);
    queryClient.invalidateQueries({ queryKey: ['saved-views', entityType] });
    if (activeTab === viewId) onTabChange('all', {});
    toast.success('Visualização removida');
  };

  const tabClass = (isActive: boolean) =>
    `relative px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200 border-b-2 ${
      isActive
        ? 'border-primary text-primary bg-primary/5'
        : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
    }`;

  return (
    <>
      <div className="flex items-center gap-1 border-b border-border -mb-px overflow-x-auto">
        <button className={tabClass(activeTab === 'all')} onClick={() => onTabChange('all', {})}>
          Todos
        </button>
        <button className={`${tabClass(activeTab === 'mine')} group flex items-center gap-1.5`} onClick={() => onTabChange('mine', { ownerId: 'mine' })}>
          Meus registros
          {activeTab === 'mine' && (
            <span
              onClick={(e) => { e.stopPropagation(); onTabChange('all', {}); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10"
            >
              <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </span>
          )}
        </button>
        <button className={`${tabClass(activeTab === 'recent')} group flex items-center gap-1.5`} onClick={() => {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          onTabChange('recent', { createdAfter: sevenDaysAgo.toISOString().split('T')[0] });
        }}>
          Criados recentemente
          {activeTab === 'recent' && (
            <span
              onClick={(e) => { e.stopPropagation(); onTabChange('all', {}); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10"
            >
              <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </span>
          )}
        </button>

        {savedViews.map((v) => (
          <button
            key={v.id}
            className={`${tabClass(activeTab === v.id)} group flex items-center gap-1.5`}
            onClick={() => onTabChange(v.id, v.filters as Filters)}
          >
            {v.name}
            <span
              onClick={(e) => handleDeleteView(v.id, e)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10"
            >
              <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </span>
          </button>
        ))}

        <button
          onClick={() => {
            if (!hasActiveFilters) {
              toast.info('Aplique filtros antes de salvar uma visualização');
              return;
            }
            setSaveOpen(true);
          }}
          className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 ml-1"
          title="Salvar visualização atual"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Salvar Visualização</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Ex: Negócios > 50k"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              maxLength={50}
            />
            <Button className="w-full" onClick={handleSave} disabled={!viewName.trim()}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
