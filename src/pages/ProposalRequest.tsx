import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, Send, CalendarRange } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import EstimatorGantt from '@/components/EstimatorGantt';
import { DatePickerField } from '@/components/DatePickerField';

const BUSINESS_AREAS = [
  'Infraestrutura Predial',
  'Missão Crítica',
  'Segurança Eletrônica',
  'Inteligência Predial',
  'Energia',
  'Outro',
];

const STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

export default function ProposalRequest() {
  const [form, setForm] = useState({
    requester_name: '', requester_email: '',
    client_name: '', client_role: '', client_email: '', client_phone: '', client_company: '',
    business_area: '', address: '', state: '', team_type: '', project_phase: '',
    has_team: false, team_description: '', qualification_level: '', target_delivery_date: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [showGantt, setShowGantt] = useState(false);

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.requester_name.trim() || !form.requester_email.trim()) {
      setError('Preencha seus dados (nome e e-mail do solicitante).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.requester_email)) {
      setError('E-mail do solicitante inválido.');
      return;
    }
    if (!form.client_name.trim() || !form.client_company.trim()) {
      setError('Nome do cliente e empresa são obrigatórios.');
      return;
    }
    if (!form.business_area) {
      setError('Selecione a área de negócio.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('capture-proposal-request', {
        body: form,
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar solicitação.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Solicitação Enviada!</h2>
            <p className="text-muted-foreground text-sm">
              Sua solicitação de proposta foi recebida com sucesso. Nossa equipe entrará em contato em breve.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Solicitar Proposta</h1>
          <p className="text-muted-foreground text-sm">
            Preencha o formulário abaixo para solicitar uma proposta comercial.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Seus Dados</CardTitle>
              <CardDescription>Dados de quem está solicitando a proposta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="requester_name">Nome do Solicitante *</Label>
                  <Input id="requester_name" value={form.requester_name} onChange={e => set('requester_name', e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="requester_email">E-mail *</Label>
                  <Input id="requester_email" type="email" value={form.requester_email} onChange={e => set('requester_email', e.target.value)} maxLength={255} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dados do Cliente</CardTitle>
              <CardDescription>Informações sobre o cliente final</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="client_name">Nome *</Label>
                  <Input id="client_name" value={form.client_name} onChange={e => set('client_name', e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client_role">Cargo</Label>
                  <Input id="client_role" value={form.client_role} onChange={e => set('client_role', e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client_email">E-mail</Label>
                  <Input id="client_email" type="email" value={form.client_email} onChange={e => set('client_email', e.target.value)} maxLength={255} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client_phone">Telefone</Label>
                  <Input id="client_phone" value={form.client_phone} onChange={e => set('client_phone', e.target.value)} maxLength={20} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="client_company">Empresa *</Label>
                  <Input id="client_company" value={form.client_company} onChange={e => set('client_company', e.target.value)} maxLength={100} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dados da Solicitação</CardTitle>
              <CardDescription>Detalhes técnicos do projeto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Área de Negócio *</Label>
                  <Select value={form.business_area} onValueChange={v => set('business_area', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {BUSINESS_AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Estado</Label>
                  <Select value={form.state} onValueChange={v => set('state', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input id="address" value={form.address} onChange={e => set('address', e.target.value)} maxLength={200} />
                </div>
                <div className="space-y-1.5">
                  <Label>Equipe</Label>
                  <Select value={form.team_type} onValueChange={v => set('team_type', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Volante">Volante</SelectItem>
                      <SelectItem value="Residente">Residente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="project_phase">Fase do Projeto</Label>
                  <Input id="project_phase" value={form.project_phase} onChange={e => set('project_phase', e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nível de Qualificação</Label>
                  <Select value={form.qualification_level} onValueChange={v => set('qualification_level', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Básico">Básico</SelectItem>
                      <SelectItem value="Intermediário">Intermediário</SelectItem>
                      <SelectItem value="Avançado">Avançado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 flex items-end gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.has_team} onCheckedChange={v => set('has_team', v)} />
                    <Label>Cliente possui equipe?</Label>
                  </div>
                </div>
                {form.has_team && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="team_description">Descreva a equipe do cliente</Label>
                    <Textarea id="team_description" value={form.team_description} onChange={e => set('team_description', e.target.value)} maxLength={500} rows={2} />
                  </div>
                )}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Data de Entrega Desejada</Label>
                  <DatePickerField value={form.target_delivery_date} onChange={v => set('target_delivery_date', v)} placeholder="Selecionar data desejada" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gantt mini */}
          <Card>
            <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowGantt(!showGantt)}>
              <div className="flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Ocupação da Equipe de Orçamentistas</CardTitle>
              </div>
              <CardDescription>Clique para {showGantt ? 'ocultar' : 'visualizar'} a disponibilidade</CardDescription>
            </CardHeader>
            {showGantt && (
              <CardContent>
                <EstimatorGantt mini />
              </CardContent>
            )}
          </Card>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading} size="lg">
            {loading ? 'Enviando...' : (
              <span className="flex items-center gap-2"><Send className="h-4 w-4" /> Enviar Solicitação</span>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
