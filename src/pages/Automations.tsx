import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Zap, Trash2, Play, Pause } from 'lucide-react';

const TRIGGERS = [
  { value: 'on_deal_create', label: 'Negócio criado' },
  { value: 'on_deal_update', label: 'Negócio atualizado (etapa muda)' },
  { value: 'on_contact_create', label: 'Contato criado' },
];

const STAGES = [
  { value: 'prospeccao', label: 'Prospecção' },
  { value: 'qualificacao', label: 'Qualificação' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'fechado', label: 'Fechado' },
];

const ACTIONS = [
  { value: 'create_task', label: 'Criar Tarefa' },
  { value: 'send_notification', label: 'Enviar Notificação' },
  { value: 'update_field', label: 'Atualizar Campo' },
];

type AutomationRule = {
  id: string;
  name: string;
  trigger_event: string;
  conditions: Record<string, string>;
  action_type: string;
  action_config: Record<string, string>;
  is_active: boolean;
  created_at: string;
};

export default function Automations() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    trigger_event: 'on_deal_update',
    condition_field: 'stage',
    condition_value: 'proposta',
    action_type: 'create_task',
    action_task_title: '',
    action_assign_to: 'owner',
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['automation-rules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('automation_rules').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as AutomationRule[];
    },
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('automation_rules').insert({
      name: form.name.trim(),
      trigger_event: form.trigger_event,
      conditions: {
        field: form.condition_field,
        operator: 'equals',
        value: form.condition_value,
      },
      action_type: form.action_type,
      action_config: {
        task_title: form.action_task_title.trim() || `Tarefa automática - ${form.name}`,
        assign_to: form.action_assign_to,
      },
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      toast.error(role !== 'admin' ? 'Apenas admins podem criar automações' : 'Erro: ' + error.message);
    } else {
      toast.success('Automação criada!');
      setOpen(false);
      setForm({ name: '', trigger_event: 'on_deal_update', condition_field: 'stage', condition_value: 'proposta', action_type: 'create_task', action_task_title: '', action_assign_to: 'owner' });
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    }
  };

  const toggleRule = async (rule: AutomationRule) => {
    const { error } = await supabase.from('automation_rules').update({ is_active: !rule.is_active }).eq('id', rule.id);
    if (error) {
      toast.error('Erro ao atualizar');
    } else {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    }
  };

  const deleteRule = async (id: string) => {
    const { error } = await supabase.from('automation_rules').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir');
    } else {
      toast.success('Automação excluída');
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    }
  };

  const getTriggerLabel = (v: string) => TRIGGERS.find((t) => t.value === v)?.label || v;
  const getActionLabel = (v: string) => ACTIONS.find((a) => a.value === v)?.label || v;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <Zap className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Automações</h1>
            <p className="text-sm text-muted-foreground">Configure regras automáticas para seu pipeline</p>
          </div>
        </div>
        {role === 'admin' && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Automação</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Criar Automação</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-5">
                <div className="space-y-2">
                  <Label>Nome da automação</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Criar tarefa ao avançar para Proposta" required maxLength={100} />
                </div>

                {/* Trigger */}
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pt-4 space-y-3">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider">QUANDO</p>
                    <Select value={form.trigger_event} onValueChange={(v) => setForm({ ...form, trigger_event: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TRIGGERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {/* Condition */}
                <Card className="border-warning/20 bg-warning/5">
                  <CardContent className="pt-4 space-y-3">
                    <p className="text-xs font-semibold text-warning uppercase tracking-wider">SE (Condição)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={form.condition_field} onValueChange={(v) => setForm({ ...form, condition_field: v })}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stage">Etapa do funil</SelectItem>
                          <SelectItem value="value">Valor</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.condition_field === 'stage' ? (
                        <Select value={form.condition_value} onValueChange={(v) => setForm({ ...form, condition_value: v })}>
                          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input type="number" placeholder="Valor mínimo" value={form.condition_value} onChange={(e) => setForm({ ...form, condition_value: e.target.value })} className="text-xs" />
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Action */}
                <Card className="border-success/20 bg-success/5">
                  <CardContent className="pt-4 space-y-3">
                    <p className="text-xs font-semibold text-success uppercase tracking-wider">ENTÃO (Ação)</p>
                    <Select value={form.action_type} onValueChange={(v) => setForm({ ...form, action_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {form.action_type === 'create_task' && (
                      <>
                        <Input placeholder="Título da tarefa" value={form.action_task_title} onChange={(e) => setForm({ ...form, action_task_title: e.target.value })} className="text-sm" maxLength={100} />
                        <Select value={form.action_assign_to} onValueChange={(v) => setForm({ ...form, action_assign_to: v })}>
                          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Proprietário do negócio</SelectItem>
                            <SelectItem value="creator">Criador da regra</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Criando...' : 'Criar Automação'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma automação configurada</p>
            <p className="text-xs text-muted-foreground mt-1">Crie regras para automatizar tarefas repetitivas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id} className={`border-border ${!rule.is_active ? 'opacity-60' : ''}`}>
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${rule.is_active ? 'bg-success/10' : 'bg-muted'}`}>
                      {rule.is_active ? <Play className="h-4 w-4 text-success" /> : <Pause className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">{rule.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">QUANDO: {getTriggerLabel(rule.trigger_event)}</Badge>
                        <Badge variant="secondary" className="text-[10px] bg-warning/10 text-warning">
                          SE: {(rule.conditions as any)?.field} = {(rule.conditions as any)?.value}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] bg-success/10 text-success">ENTÃO: {getActionLabel(rule.action_type)}</Badge>
                      </div>
                    </div>
                  </div>
                  {role === 'admin' && (
                    <div className="flex items-center gap-2">
                      <Switch checked={rule.is_active} onCheckedChange={() => toggleRule(rule)} />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteRule(rule.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
