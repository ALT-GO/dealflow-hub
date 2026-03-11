import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCustomProperties } from '@/hooks/useCustomProperties';
import { DynamicFields, saveCustomPropertyValues } from '@/components/DynamicFields';
import { useFunnelStages } from '@/hooks/useFunnelStages';

export function NewDealModal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: stagesData = [] } = useFunnelStages();
  const STAGES = stagesData.filter(s => s.key !== 'perdido').map(s => ({ value: s.key, label: s.label }));
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    name: '',
    value: '',
    stage: 'prospeccao',
    close_date: '',
    company_id: '',
    contact_id: '',
  });
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { data: customProps = [] } = useCustomProperties('deals');

  useEffect(() => {
    if (open) {
      supabase.from('companies').select('id, name').order('name').then(({ data }) => {
        if (data) setCompanies(data);
      });
    }
  }, [open]);

  useEffect(() => {
    if (form.company_id) {
      supabase.from('contacts').select('id, name').eq('company_id', form.company_id).order('name').then(({ data }) => {
        if (data) setContacts(data);
      });
    } else {
      setContacts([]);
    }
  }, [form.company_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.from('deals').insert({
      name: form.name,
      value: parseFloat(form.value) || 0,
      stage: form.stage,
      close_date: form.close_date || null,
      company_id: form.company_id,
      contact_id: form.contact_id || null,
      owner_id: user.id,
    }).select('id').single();
    if (error) {
      toast.error('Erro ao criar negócio: ' + error.message);
      setLoading(false);
      return;
    }
    if (data && Object.keys(customValues).length > 0) {
      await saveCustomPropertyValues(data.id, customValues, supabase);
    }
    setLoading(false);
    toast.success('Negócio criado!');
    queryClient.invalidateQueries({ queryKey: ['deals'] });
    setOpen(false);
    setForm({ name: '', value: '', stage: 'prospeccao', close_date: '', company_id: '', contact_id: '' });
    setCustomValues({});
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Negócio
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Negócio</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome do negócio</Label>
            <Input placeholder="Nome do negócio" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
            <Input type="number" step="0.01" placeholder="Valor (R$)" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Etapa</Label>
            <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Empresa</Label>
            <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v, contact_id: '' })}>
              <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {contacts.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Contato</Label>
              <Select value={form.contact_id} onValueChange={(v) => setForm({ ...form, contact_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o contato" /></SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Data de fechamento</Label>
            <Input type="date" value={form.close_date} onChange={(e) => setForm({ ...form, close_date: e.target.value })} />
          </div>

          {customProps.length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Campos Customizados</p>
              <DynamicFields properties={customProps} values={customValues} onChange={setCustomValues} />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading || !form.company_id}>
            {loading ? 'Criando...' : 'Criar Negócio'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
