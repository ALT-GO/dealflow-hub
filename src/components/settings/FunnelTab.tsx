import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { GripVertical, Plus, Trash2, Pencil, Loader2 } from 'lucide-react';

export function FunnelTab() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const { data: stages = [], isLoading } = useFunnelStages();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ key: '', label: '', color: 'bg-muted text-muted-foreground' });
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['funnel-stages'] });

  const handleAdd = async () => {
    if (!form.key.trim() || !form.label.trim()) return;
    setSaving(true);
    const maxOrder = stages.length > 0 ? Math.max(...stages.map(s => s.sort_order)) + 1 : 0;
    const { error } = await supabase.from('funnel_stages').insert({
      key: form.key.trim().toLowerCase().replace(/\s+/g, '_'),
      label: form.label.trim(),
      color: form.color,
      sort_order: maxOrder,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message.includes('duplicate') ? 'Chave já existe' : 'Erro: ' + error.message); return; }
    toast.success('Estágio criado!');
    setAddOpen(false);
    setForm({ key: '', label: '', color: 'bg-muted text-muted-foreground' });
    invalidate();
  };

  const handleEdit = async () => {
    if (!editOpen || !form.label.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('funnel_stages').update({ label: form.label.trim(), color: form.color } as any).eq('id', editOpen);
    setSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Estágio atualizado!');
    setEditOpen(null);
    invalidate();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    const { error } = await supabase.from('funnel_stages').delete().eq('id', deleteId);
    setSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Estágio excluído!');
    setDeleteId(null);
    invalidate();
  };

  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDrop = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const items = [...stages];
    const fromIdx = items.findIndex(s => s.id === draggedId);
    const toIdx = items.findIndex(s => s.id === targetId);
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);

    // Update sort orders
    const updates = items.map((s, i) => supabase.from('funnel_stages').update({ sort_order: i } as any).eq('id', s.id));
    await Promise.all(updates);
    setDraggedId(null);
    invalidate();
    toast.success('Ordem atualizada!');
  };

  const stageToDelete = stages.find(s => s.id === deleteId);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Estágios do funil de vendas utilizados no pipeline de negócios.</p>
        {role === 'admin' && (
          <Button size="sm" onClick={() => { setForm({ key: '', label: '', color: 'bg-muted text-muted-foreground' }); setAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Novo Estágio
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {stages.map((stage, index) => (
              <div
                key={stage.id}
                className="flex items-center gap-4 px-5 py-3 group"
                draggable={role === 'admin'}
                onDragStart={() => handleDragStart(stage.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(stage.id)}
              >
                {role === 'admin' && <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />}
                <span className="text-sm font-medium text-foreground w-8">{index + 1}.</span>
                <Badge className={`${stage.color} border-0 text-xs`}>{stage.label}</Badge>
                <code className="text-xs text-muted-foreground font-mono ml-auto mr-2">{stage.key}</code>
                {stage.is_system && <Badge variant="outline" className="text-[10px]">Sistema</Badge>}
                {role === 'admin' && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setForm({ key: stage.key, label: stage.label, color: stage.color }); setEditOpen(stage.id); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {!stage.is_system && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteId(stage.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Novo Estágio</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value, key: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_') })} placeholder="Ex: Demonstração" />
            </div>
            <div className="space-y-2">
              <Label>Chave (slug)</Label>
              <Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="demonstracao" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} disabled={saving || !form.label.trim() || !form.key.trim()}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Criar Estágio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editOpen} onOpenChange={(o) => !o && setEditOpen(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Editar Estágio</DialogTitle></DialogHeader>
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
            <AlertDialogTitle>Excluir estágio</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o estágio "{stageToDelete?.label}"? Negócios neste estágio podem ficar sem categoria.
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
