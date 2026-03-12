import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Filter, X, Save, Trash2 } from 'lucide-react';
import { DatePickerField } from '@/components/DatePickerField';

export type Filters = {
  minValue?: string;
  maxValue?: string;
  createdAfter?: string;
  createdBefore?: string;
  ownerId?: string;
};

type SavedView = {
  id: string;
  name: string;
  filters: Filters;
};

type Props = {
  entityType: 'companies' | 'contacts' | 'deals';
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  activeViewId?: string;
  onViewSelect?: (view: SavedView | null) => void;
};

export function AdvancedFilters({ entityType, filters, onFiltersChange, activeViewId, onViewSelect }: Props) {
  const { user, role: userRole } = useAuth();
  const canSeeOwnerFilter = userRole === 'admin' || userRole === 'gerencia';
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
      return data as SavedView[];
    },
  });

  const hasFilters = Object.values(filters).some((v) => v && v !== '');
  const activeCount = Object.values(filters).filter((v) => v && v !== '').length;

  const handleClear = () => {
    onFiltersChange({});
    onViewSelect?.(null);
  };

  const handleSaveView = async () => {
    if (!viewName.trim() || !user) return;
    const { error } = await supabase.from('saved_views').insert({
      name: viewName.trim(),
      entity_type: entityType,
      filters: filters as any,
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

  const handleDeleteView = async (viewId: string) => {
    await supabase.from('saved_views').delete().eq('id', viewId);
    queryClient.invalidateQueries({ queryKey: ['saved-views', entityType] });
    if (activeViewId === viewId) {
      handleClear();
    }
    toast.success('Visualização removida');
  };

  return (
    <div className="space-y-3">
      {/* Saved views tabs */}
      {savedViews.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={!activeViewId ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-7"
            onClick={() => { handleClear(); }}
          >
            Todos
          </Button>
          {savedViews.map((v) => (
            <div key={v.id} className="flex items-center gap-0.5">
              <Button
                variant={activeViewId === v.id ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  onViewSelect?.(v);
                  onFiltersChange(v.filters);
                }}
              >
                {v.name}
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteView(v.id)}>
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              Filtros Avançados
              {activeCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80">
            <SheetHeader>
              <SheetTitle>Filtros Avançados</SheetTitle>
            </SheetHeader>
            <div className="space-y-5 mt-6">
              {(entityType === 'deals' || entityType === 'companies') && (
                <div className="space-y-3">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor do Negócio</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Mínimo</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={filters.minValue || ''}
                        onChange={(e) => onFiltersChange({ ...filters, minValue: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Máximo</Label>
                      <Input
                        type="number"
                        placeholder="∞"
                        value={filters.maxValue || ''}
                        onChange={(e) => onFiltersChange({ ...filters, maxValue: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data de Criação</Label>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">De</Label>
                    <DatePickerField
                      value={filters.createdAfter || ''}
                      onChange={(v) => onFiltersChange({ ...filters, createdAfter: v })}
                      placeholder="Data inicial"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Até</Label>
                    <DatePickerField
                      value={filters.createdBefore || ''}
                      onChange={(v) => onFiltersChange({ ...filters, createdBefore: v })}
                      placeholder="Data final"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              {canSeeOwnerFilter && (
                <div className="space-y-3">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proprietário</Label>
                  <Select value={filters.ownerId || 'all'} onValueChange={(v) => onFiltersChange({ ...filters, ownerId: v === 'all' ? '' : v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="mine">Meus registros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {entityType === 'deals' && (
                <div className="space-y-3">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qualificação (Estrelas)</Label>
                  <Select value={(filters as any).minStars || 'all'} onValueChange={(v) => onFiltersChange({ ...filters, minStars: v === 'all' ? '' : v } as any)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="1">⭐ 1+ estrela</SelectItem>
                      <SelectItem value="2">⭐⭐ 2+ estrelas</SelectItem>
                      <SelectItem value="3">⭐⭐⭐ 3+ estrelas</SelectItem>
                      <SelectItem value="4">⭐⭐⭐⭐ 4+ estrelas</SelectItem>
                      <SelectItem value="5">⭐⭐⭐⭐⭐ 5 estrelas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-border">
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={handleClear} className="text-xs gap-1">
                    <X className="h-3 w-3" />Limpar
                  </Button>
                )}
                {hasFilters && (
                  <Button variant="outline" size="sm" onClick={() => setSaveOpen(true)} className="text-xs gap-1">
                    <Save className="h-3 w-3" />Salvar Visualização
                  </Button>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground" onClick={handleClear}>
            <X className="h-3 w-3" />Limpar filtros
          </Button>
        )}
      </div>

      {/* Save view dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Salvar Visualização</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da visualização</Label>
              <Input
                placeholder="Ex: Negócios acima de R$10k"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                maxLength={50}
              />
            </div>
            <Button className="w-full" onClick={handleSaveView} disabled={!viewName.trim()}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
