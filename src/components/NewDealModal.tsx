import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

const STAGES = [
  { value: 'prospeccao', label: 'Prospecção' },
  { value: 'qualificacao', label: 'Qualificação' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'fechado', label: 'Fechado' },
];

export function NewDealModal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
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
  const [loading, setLoading] = useState(false);

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
    const { error } = await supabase.from('deals').insert({
      name: form.name,
      value: parseFloat(form.value) || 0,
      stage: form.stage,
      close_date: form.close_date || null,
      company_id: form.company_id,
      contact_id: form.contact_id || null,
      owner_id: user.id,
    });
    setLoading(false);
    if (error) {
      toast.error('Erro ao criar negócio: ' + error.message);
    } else {
      toast.success('Negócio criado!');
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setOpen(false);
      setForm({ name: '', value: '', stage: 'prospeccao', close_date: '', company_id: '', contact_id: '' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Negócio
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Negócio</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input placeholder="Nome do negócio" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input type="number" step="0.01" placeholder="Valor (R$)" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v, contact_id: '' })}>
            <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
            <SelectContent>
              {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {contacts.length > 0 && (
            <Select value={form.contact_id} onValueChange={(v) => setForm({ ...form, contact_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione o contato" /></SelectTrigger>
              <SelectContent>
                {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Input type="date" value={form.close_date} onChange={(e) => setForm({ ...form, close_date: e.target.value })} />
          <Button type="submit" className="w-full" disabled={loading || !form.company_id}>
            {loading ? 'Criando...' : 'Criar Negócio'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
