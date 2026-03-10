import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Plus, CheckSquare, Calendar, Circle } from 'lucide-react';

type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  deal_id: string | null;
  contact_id: string | null;
};

type Props = {
  dealId?: string;
  contactId?: string;
};

export function TasksChecklist({ dealId, contactId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', due_date: '' });
  const [saving, setSaving] = useState(false);

  const queryKey = ['tasks', dealId || '', contactId || ''];

  const { data: tasks = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase.from('tasks').select('*').order('completed').order('due_date', { ascending: true, nullsFirst: false });
      if (dealId) q = q.eq('deal_id', dealId);
      if (contactId) q = q.eq('contact_id', contactId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Task[];
    },
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('tasks').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      due_date: form.due_date || null,
      deal_id: dealId || null,
      contact_id: contactId || null,
      assigned_to: user.id,
      created_by: user.id,
    });
    setSaving(false);
    if (error) { toast.error('Erro ao criar tarefa'); return; }
    toast.success('Tarefa criada!');
    setForm({ title: '', description: '', due_date: '' });
    setOpen(false);
    queryClient.invalidateQueries({ queryKey });
  };

  const toggleTask = async (taskId: string, completed: boolean) => {
    await supabase.from('tasks').update({ completed: !completed }).eq('id', taskId);
    queryClient.invalidateQueries({ queryKey });
  };

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <CheckSquare className="h-4 w-4" />
            Tarefas ({completedCount}/{tasks.length})
          </CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7"><Plus className="h-4 w-4" /></Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Enviar proposta" required maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalhes..." rows={2} maxLength={500} />
                </div>
                <div className="space-y-2">
                  <Label>Data limite</Label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
                <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Criando...' : 'Criar Tarefa'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-1">
            {tasks.map((t) => {
              const isOverdue = t.due_date && !t.completed && new Date(t.due_date) < new Date();
              return (
                <div
                  key={t.id}
                  className={`flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer ${t.completed ? 'opacity-50' : ''}`}
                  onClick={() => toggleTask(t.id, t.completed)}
                >
                  <Checkbox checked={t.completed} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${t.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{t.title}</p>
                    {t.due_date && (
                      <p className={`text-[10px] flex items-center gap-1 mt-0.5 ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        <Calendar className="h-3 w-3" />
                        {new Date(t.due_date).toLocaleDateString('pt-BR')}
                        {isOverdue && ' (atrasada)'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            {tasks.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tarefa</p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
