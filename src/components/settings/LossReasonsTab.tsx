import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLossReasons } from '@/hooks/useLossReasons';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { GripVertical, Plus, Trash2, Pencil, Loader2 } from 'lucide-react';

export function LossReasonsTab() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const { data: reasons = [], isLoading } = useLossReasons();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ value: '', label: '' });
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['loss-reasons'] });

  const handleAdd = async () => {
    if (!form.value.trim() || !form.label.trim()) return;
    setSaving(true);
    const maxOrder = reasons.length > 0 ? Math.max(...reasons.map(r => r.sort_order)) + 1 : 0;
    const { error } = await supabase.from('loss_reasons').insert({
      value: form.value.trim().toLowerCase().replace(/\s+/g, '_'),
      label: form.label.trim(),
      sort_order: maxOrder,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message.includes('duplicate') ? 'Valor já existe' : 'Erro: ' + error.message); return; }
    toast.success('Motivo criado!');
    setAddOpen(false);
    setForm({ value: '', label: '' });
    invalidate();
  };

  const handleEdit = async () => {
    if (!editOpen || !form.label.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('loss_reasons').update({ label: form.label.trim() } as any).eq('id', editOpen);
    setSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Motivo atualizado!');
    setEditOpen(null);
    invalidate();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    const { error } = await supabase.from('loss_reasons').delete().eq('id', deleteId);
    setSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Motivo excluído!');
    setDeleteId(null);
    invalidate();
  };

  const handleDrop = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const items = [...reasons];
    const fromIdx = items.findIndex(r => r.id === draggedId);
    const toIdx = items.findIndex(r => r.id === targetId);
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    const updates = items.map((r, i) => supabase.from('loss_reasons').update({ sort_order: i } as any).eq('id', r.id));
    await Promise.all(updates);
    setDraggedId(null);
    invalidate();
    toast.success('Ordem atualizada!');
  };

  const reasonToDelete = reasons.find(r => r.id === deleteId);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Motivos disponíveis ao marcar um negócio como perdido.</p>
        {role === 'admin' && (
          <Button size="sm" onClick={() => { setForm({ value: '', label: '' }); setAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Novo Motivo
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {reasons.map((reason) => (
              <div
                key={reason.id}
                className="flex items-center gap-4 px-5 py-3 group"
                draggable={role === 'admin'}
                onDragStart={() => setDraggedId(reason.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(reason.id)}
              >
                {role === 'admin' && <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />}
                <Badge variant="outline" className="text-xs border-destructive/30 text-destructive bg-destructive/5">
                  {reason.label}
                </Badge>
                <code className="text-xs text-muted-foreground font-mono ml-auto mr-2">{reason.value}</code>
                {role === 'admin' && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setForm({ value: reason.value, label: reason.label }); setEditOpen(reason.id); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteId(reason.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {reasons.length === 0 && (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">Nenhum motivo cadastrado</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Novo Motivo de Perda</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value, value: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_') })} placeholder="Ex: Produto inadequado" />
            </div>
            <div className="space-y-2">
              <Label>Valor (slug)</Label>
              <Input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="produto_inadequado" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} disabled={saving || !form.label.trim() || !form.value.trim()}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Criar Motivo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editOpen} onOpenChange={(o) => !o && setEditOpen(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Editar Motivo</DialogTitle></DialogHeader>
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir motivo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o motivo "{reasonToDelete?.label}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
