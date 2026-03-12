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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

import { toast } from 'sonner';
import { GripVertical, Plus, Trash2, Pencil, Loader2 } from 'lucide-react';

const VISIBILITY_OPTIONS = [
  { value: 'vendas', label: 'Vendas', roles: ['admin', 'gerencia', 'vendedor'] },
  { value: 'orcamentos', label: 'Orçamentos', roles: ['admin', 'gerencia', 'orcamentista'] },
  { value: 'ambos', label: 'Ambos', roles: ['admin', 'gerencia', 'orcamentista', 'vendedor'] },
];

function rolesToVisibility(roles: string[]): string {
  const hasVendedor = roles.includes('vendedor');
  const hasOrcamentista = roles.includes('orcamentista');
  if (hasVendedor && hasOrcamentista) return 'ambos';
  if (hasOrcamentista) return 'orcamentos';
  return 'vendas';
}

function visibilityToRoles(vis: string): string[] {
  return VISIBILITY_OPTIONS.find(v => v.value === vis)?.roles || ['admin', 'gerencia', 'orcamentista', 'vendedor'];
}

const STAGE_TYPE_LABELS: Record<string, string> = {
  active: 'Ativa',
  won: 'Ganha',
  lost: 'Perdida',
};

const STAGE_TYPE_COLORS: Record<string, string> = {
  active: 'bg-muted text-muted-foreground',
  won: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-destructive/10 text-destructive',
};

const COLOR_OPTIONS = [
  { value: 'bg-muted text-muted-foreground', label: 'Cinza', swatch: 'bg-gray-400' },
  { value: 'bg-blue-100 text-blue-800', label: 'Azul', swatch: 'bg-blue-500' },
  { value: 'bg-sky-100 text-sky-800', label: 'Céu', swatch: 'bg-sky-500' },
  { value: 'bg-indigo-100 text-indigo-800', label: 'Índigo', swatch: 'bg-indigo-500' },
  { value: 'bg-violet-100 text-violet-800', label: 'Violeta', swatch: 'bg-violet-500' },
  { value: 'bg-purple-100 text-purple-800', label: 'Roxo', swatch: 'bg-purple-500' },
  { value: 'bg-pink-100 text-pink-800', label: 'Rosa', swatch: 'bg-pink-500' },
  { value: 'bg-rose-100 text-rose-800', label: 'Rosê', swatch: 'bg-rose-500' },
  { value: 'bg-red-100 text-red-800', label: 'Vermelho', swatch: 'bg-red-500' },
  { value: 'bg-orange-100 text-orange-800', label: 'Laranja', swatch: 'bg-orange-500' },
  { value: 'bg-amber-100 text-amber-800', label: 'Âmbar', swatch: 'bg-amber-500' },
  { value: 'bg-yellow-100 text-yellow-800', label: 'Amarelo', swatch: 'bg-yellow-500' },
  { value: 'bg-lime-100 text-lime-800', label: 'Lima', swatch: 'bg-lime-500' },
  { value: 'bg-green-100 text-green-800', label: 'Verde', swatch: 'bg-green-500' },
  { value: 'bg-emerald-100 text-emerald-800', label: 'Esmeralda', swatch: 'bg-emerald-500' },
  { value: 'bg-teal-100 text-teal-800', label: 'Teal', swatch: 'bg-teal-500' },
  { value: 'bg-cyan-100 text-cyan-800', label: 'Ciano', swatch: 'bg-cyan-500' },
];

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {COLOR_OPTIONS.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          onClick={() => onChange(c.value)}
          className={`h-7 w-7 rounded-full ${c.swatch} transition-all duration-150 ring-offset-background ${value === c.value ? 'ring-2 ring-primary ring-offset-2 scale-110' : 'hover:scale-110 hover:ring-1 hover:ring-muted-foreground/30'}`}
        />
      ))}
    </div>
  );
}

export function FunnelTab() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const { data: stages = [], isLoading } = useFunnelStages();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ key: '', label: '', color: 'bg-muted text-muted-foreground', stage_type: 'active' as 'active' | 'won' | 'lost', visibility: 'ambos' });
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
      stage_type: form.stage_type,
      allowed_roles: visibilityToRoles(form.visibility),
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message.includes('duplicate') ? 'Chave já existe' : 'Erro: ' + error.message); return; }
    toast.success('Estágio criado!');
    setAddOpen(false);
    setForm({ key: '', label: '', color: 'bg-muted text-muted-foreground', stage_type: 'active', visibility: 'ambos' });
    invalidate();
  };

  const handleEdit = async () => {
    if (!editOpen || !form.label.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('funnel_stages').update({ label: form.label.trim(), color: form.color, stage_type: form.stage_type, allowed_roles: visibilityToRoles(form.visibility) } as any).eq('id', editOpen);
    setSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Estágio atualizado!');
    setEditOpen(null);
    invalidate();
  };

  const handleTryDelete = async (stageId: string) => {
    const stage = stages.find(s => s.id === stageId);
    if (!stage) return;
    // Check if there are deals in this stage
    const { count, error } = await supabase.from('deals').select('id', { count: 'exact', head: true }).eq('stage', stage.key);
    if (error) { toast.error('Erro ao verificar negócios'); return; }
    if (count && count > 0) {
      setDeleteBlocked(count);
      return;
    }
    setDeleteId(stageId);
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
          <Button size="sm" onClick={() => { setForm({ key: '', label: '', color: 'bg-muted text-muted-foreground', stage_type: 'active', visibility: 'ambos' }); setAddOpen(true); }}>
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
                <Badge className={`${STAGE_TYPE_COLORS[stage.stage_type]} border-0 text-[10px]`}>{STAGE_TYPE_LABELS[stage.stage_type]}</Badge>
                {(() => {
                  const vis = rolesToVisibility(stage.allowed_roles || ['admin','gerencia','orcamentista','vendedor']);
                  return (
                    <Badge className={`text-[10px] border-0 ${vis === 'vendas' ? 'bg-blue-100 text-blue-700' : vis === 'orcamentos' ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                      {VISIBILITY_OPTIONS.find(v => v.value === vis)?.label}
                    </Badge>
                  );
                })()}
                <code className="text-xs text-muted-foreground font-mono ml-auto mr-2">{stage.key}</code>
                {stage.is_system && <Badge variant="outline" className="text-[10px]">Sistema</Badge>}
                {role === 'admin' && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setForm({ key: stage.key, label: stage.label, color: stage.color, stage_type: stage.stage_type, visibility: rolesToVisibility(stage.allowed_roles || ['admin','gerencia','orcamentista','vendedor']) }); setEditOpen(stage.id); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => handleTryDelete(stage.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
            <div className="space-y-2">
              <Label>Tipo de Estágio</Label>
              <Select value={form.stage_type} onValueChange={(v) => setForm({ ...form, stage_type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="won">Ganha</SelectItem>
                  <SelectItem value="lost">Perdida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Visibilidade</Label>
              <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="space-y-2">
              <Label>Tipo de Estágio</Label>
              <Select value={form.stage_type} onValueChange={(v) => setForm({ ...form, stage_type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="won">Ganha</SelectItem>
                  <SelectItem value="lost">Perdida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Visibilidade</Label>
              <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Blocked Delete Info */}
      <AlertDialog open={deleteBlocked !== null} onOpenChange={(o) => !o && setDeleteBlocked(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Não é possível excluir</AlertDialogTitle>
            <AlertDialogDescription>
              Existem {deleteBlocked} negócio(s) neste estágio. Mova-os para outro estágio antes de excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Entendi</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
