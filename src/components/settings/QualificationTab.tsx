import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

export type QualificationQuestion = {
  id: string;
  question: string;
  question_type: string;
  weight: number;
  options: { label: string; score: number }[] | null;
  sort_order: number;
  is_active: boolean;
};

export function useQualificationQuestions() {
  return useQuery({
    queryKey: ['qualification-questions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('qualification_questions').select('*').order('sort_order');
      if (error) throw error;
      return data as unknown as QualificationQuestion[];
    },
  });
}

export function QualificationTab() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const { data: questions = [], isLoading } = useQualificationQuestions();
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    question: '',
    weight: '1',
    options: [{ label: 'Sim', score: 100 }, { label: 'Não', score: 0 }] as { label: string; score: number }[],
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['qualification-questions'] });

  const handleAdd = async () => {
    if (!form.question.trim() || !user) return;
    setSaving(true);
    const maxOrder = questions.length > 0 ? Math.max(...questions.map(q => q.sort_order)) + 1 : 0;
    const { error } = await supabase.from('qualification_questions').insert({
      question: form.question.trim(),
      question_type: 'options',
      weight: parseFloat(form.weight) || 1,
      options: form.options,
      sort_order: maxOrder,
      created_by: user.id,
    } as any);
    setSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Pergunta criada!');
    setAddOpen(false);
    setForm({ question: '', weight: '1', options: [{ label: 'Sim', score: 100 }, { label: 'Não', score: 0 }] });
    invalidate();
  };

  const handleEdit = async () => {
    if (!editId || !form.question.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('qualification_questions').update({
      question: form.question.trim(),
      weight: parseFloat(form.weight) || 1,
      options: form.options,
    } as any).eq('id', editId);
    setSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Pergunta atualizada!');
    setEditId(null);
    invalidate();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from('qualification_questions').update({ is_active: active } as any).eq('id', id);
    invalidate();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    const { error } = await supabase.from('qualification_questions').delete().eq('id', deleteId);
    setSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Pergunta excluída!');
    setDeleteId(null);
    invalidate();
  };

  const addOption = () => setForm({ ...form, options: [...form.options, { label: '', score: 0 }] });
  const removeOption = (idx: number) => setForm({ ...form, options: form.options.filter((_, i) => i !== idx) });
  const updateOption = (idx: number, field: 'label' | 'score', value: string) => {
    const opts = [...form.options];
    if (field === 'score') opts[idx].score = parseFloat(value) || 0;
    else opts[idx].label = value;
    setForm({ ...form, options: opts });
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const questionToDelete = questions.find(q => q.id === deleteId);

  const OptionFields = () => (
    <div className="space-y-2">
      <Label>Opções de Resposta</Label>
      {form.options.map((opt, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input className="h-8 text-xs flex-1" placeholder="Rótulo" value={opt.label} onChange={(e) => updateOption(idx, 'label', e.target.value)} />
          <Input className="h-8 text-xs w-20" type="number" placeholder="Score %" value={opt.score} onChange={(e) => updateOption(idx, 'score', e.target.value)} />
          {form.options.length > 2 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeOption(idx)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addOption} className="text-xs"><Plus className="h-3 w-3 mr-1" />Adicionar Opção</Button>
    </div>
  );

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Perguntas de qualificação para classificar negócios com estrelas (1-5).</p>
          <p className="text-xs text-muted-foreground mt-1">Cada resposta gera um score. O score total define a classificação por estrelas.</p>
        </div>
        {role === 'admin' && (
          <Button size="sm" onClick={() => { setForm({ question: '', weight: '1', options: [{ label: 'Sim', score: 100 }, { label: 'Não', score: 0 }] }); setAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Nova Pergunta
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {questions.map((q, idx) => (
              <div key={q.id} className="flex items-center gap-4 px-5 py-3 group">
                <span className="text-sm font-medium text-foreground w-6">{idx + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{q.question}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[10px]">Peso: {q.weight}</Badge>
                    <Badge variant={q.is_active ? 'default' : 'outline'} className="text-[10px]">{q.is_active ? 'Ativa' : 'Inativa'}</Badge>
                    {q.options && <span className="text-[10px] text-muted-foreground">{(q.options as any[]).length} opções</span>}
                  </div>
                </div>
                {role === 'admin' && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Switch checked={q.is_active} onCheckedChange={(v) => handleToggle(q.id, v)} />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                      setForm({ question: q.question, weight: String(q.weight), options: (q.options as any[]) || [{ label: 'Sim', score: 100 }, { label: 'Não', score: 0 }] });
                      setEditId(q.id);
                    }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteId(q.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {questions.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma pergunta cadastrada</p>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nova Pergunta de Qualificação</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pergunta</Label>
              <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="Ex: O cliente tem orçamento definido?" />
            </div>
            <div className="space-y-2">
              <Label>Peso (importância)</Label>
              <Input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="w-24" />
            </div>
            <OptionFields />
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} disabled={saving || !form.question.trim()}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Criar Pergunta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Editar Pergunta</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pergunta</Label>
              <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Peso (importância)</Label>
              <Input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="w-24" />
            </div>
            <OptionFields />
          </div>
          <DialogFooter>
            <Button onClick={handleEdit} disabled={saving || !form.question.trim()}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pergunta</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir "{questionToDelete?.question}"?</AlertDialogDescription>
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
