import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, GripVertical } from 'lucide-react';

type Origin = { id: string; label: string; value: string; sort_order: number };

export function useOrigins() {
  return useQuery({
    queryKey: ['deal-origins'],
    queryFn: async () => {
      const { data, error } = await supabase.from('deal_origins').select('*').order('sort_order');
      if (error) throw error;
      return data as Origin[];
    },
  });
}

export function OriginsTab() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const { data: origins = [], isLoading } = useOrigins();
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ label: '', value: '' });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['deal-origins'] });

  const handleAdd = async () => {
    if (!form.label.trim()) return;
    setSaving(true);
    const maxOrder = origins.length > 0 ? Math.max(...origins.map(o => o.sort_order)) + 1 : 0;
    const { error } = await supabase.from('deal_origins').insert({
      label: form.label.trim(),
      value: form.value.trim() || form.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      sort_order: maxOrder,
    } as any);
    setSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Origem criada!');
    setAddOpen(false);
    setForm({ label: '', value: '' });
    invalidate();
  };

  const handleEdit = async () => {
    if (!editId || !form.label.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('deal_origins').update({ label: form.label.trim() } as any).eq('id', editId);
    setSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Origem atualizada!');
    setEditId(null);
    invalidate();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    const { error } = await supabase.from('deal_origins').delete().eq('id', deleteId);
    setSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Origem excluída!');
    setDeleteId(null);
    invalidate();
  };

  const handleDragStart = (e: React.DragEvent, id: string) => e.dataTransfer.setData('originId', id);
  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('originId');
    if (!draggedId || draggedId === targetId) return;
    const items = [...origins];
    const fromIdx = items.findIndex(o => o.id === draggedId);
    const toIdx = items.findIndex(o => o.id === targetId);
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    await Promise.all(items.map((o, i) => supabase.from('deal_origins').update({ sort_order: i } as any).eq('id', o.id)));
    invalidate();
    toast.success('Ordem atualizada!');
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const originToDelete = origins.find(o => o.id === deleteId);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Origens de negócios (ex: Indicação, Marketing, etc).</p>
        {role === 'admin' && (
          <Button size="sm" onClick={() => { setForm({ label: '', value: '' }); setAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Nova Origem
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {origins.map((origin, idx) => (
              <div key={origin.id} className="flex items-center gap-4 px-5 py-3 group"
                draggable={role === 'admin'}
                onDragStart={(e) => handleDragStart(e, origin.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, origin.id)}>
                {role === 'admin' && <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />}
                <span className="text-sm font-medium text-foreground">{idx + 1}.</span>
                <span className="text-sm text-foreground">{origin.label}</span>
                <code className="text-xs text-muted-foreground font-mono ml-auto mr-2">{origin.value}</code>
                {role === 'admin' && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setForm({ label: origin.label, value: origin.value }); setEditId(origin.id); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteId(origin.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {origins.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma origem cadastrada</p>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Nova Origem</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value, value: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_') })} placeholder="Ex: Indicação" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} disabled={saving || !form.label.trim()}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Criar Origem'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Editar Origem</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEdit} disabled={saving || !form.label.trim()}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir origem</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir a origem "{originToDelete?.label}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
