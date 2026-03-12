import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { CheckCircle2, Send, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SmartDatePicker } from '@/components/SmartDatePicker';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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

const TIPO_NEGOCIO_OPTIONS = ['Novo Cliente', 'Cliente Existente'];

type ContactResult = {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  company_id: string;
  companies: { name: string; phone: string | null; domain: string | null } | null;
};

export default function ProposalRequest() {
  const [form, setForm] = useState({
    requester_name: '', requester_email: '',
    client_name: '', client_role: '', client_email: '', client_phone: '', client_company: '',
    client_address: '',
    business_area: '', state: '', team_type: '',
    has_team: false, team_description: '', qualification_level: '', target_delivery_date: '',
    orcamentista_id: '',
    carbono_zero: false,
    cortex: false,
    endereco_execucao: '',
    estudo_equipe: '',
    tipo_negocio: '',
    scope: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Smart autocomplete state
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<ContactResult[]>([]);
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Company autocomplete
  const [companyResults, setCompanyResults] = useState<{ id: string; name: string }[]>([]);
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);
  const companyTimeout = useRef<NodeJS.Timeout | null>(null);

  // Role autocomplete
  const [roleResults, setRoleResults] = useState<string[]>([]);
  const [rolePopoverOpen, setRolePopoverOpen] = useState(false);
  const roleTimeout = useRef<NodeJS.Timeout | null>(null);

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  // Search contacts as user types
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (contactSearch.trim().length < 2) {
      setContactResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      const { data } = await supabase
        .from('contacts')
        .select('id, name, email, role, company_id, companies(name, phone, domain)')
        .ilike('name', `%${contactSearch.trim()}%`)
        .limit(8);
      if (data) setContactResults(data as ContactResult[]);
    }, 300);
  }, [contactSearch]);

  const handleSelectContact = (contact: ContactResult) => {
    setForm(prev => ({
      ...prev,
      client_name: contact.name,
      client_email: contact.email || '',
      client_role: contact.role || '',
      client_company: contact.companies?.name || '',
      client_phone: contact.companies?.phone || '',
      client_address: contact.companies?.domain || '',
    }));
    setContactSearch(contact.name);
    setContactPopoverOpen(false);
  };

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
          {/* Section 1 - Solicitante */}
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

          {/* Section 2 - Cliente */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dados do Cliente</CardTitle>
              <CardDescription>Informações sobre o cliente final</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Nome do Cliente *</Label>
                  <Popover open={contactPopoverOpen} onOpenChange={setContactPopoverOpen}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={contactSearch || form.client_name}
                          onChange={e => {
                            setContactSearch(e.target.value);
                            set('client_name', e.target.value);
                            if (e.target.value.trim().length >= 2) setContactPopoverOpen(true);
                          }}
                          onFocus={() => { if (contactSearch.trim().length >= 2) setContactPopoverOpen(true); }}
                          placeholder="Digite para buscar contato existente..."
                          className="pl-9"
                          maxLength={100}
                        />
                      </div>
                    </PopoverTrigger>
                    {contactResults.length > 0 && (
                      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start" sideOffset={4}>
                        <Command>
                          <CommandList>
                            <CommandGroup heading="Contatos encontrados">
                              {contactResults.map(c => (
                                <CommandItem
                                  key={c.id}
                                  onSelect={() => handleSelectContact(c)}
                                  className="cursor-pointer"
                                >
                                  <div>
                                    <p className="text-sm font-medium">{c.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {c.companies?.name || 'Sem empresa'}{c.email ? ` · ${c.email}` : ''}
                                    </p>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    )}
                  </Popover>
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
                  <Input id="client_phone" value={form.client_phone} onChange={e => set('client_phone', e.target.value)} maxLength={20} placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client_company">Empresa *</Label>
                  <Input id="client_company" value={form.client_company} onChange={e => set('client_company', e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="client_address">Endereço</Label>
                  <Input id="client_address" value={form.client_address} onChange={e => set('client_address', e.target.value)} maxLength={300} placeholder="Endereço da empresa" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3 - Solicitação */}
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
                  <Label>Tipo de Negócio</Label>
                  <Select value={form.tipo_negocio} onValueChange={v => set('tipo_negocio', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {TIPO_NEGOCIO_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="endereco_execucao">Endereço de Execução dos Serviços</Label>
                  <Input id="endereco_execucao" value={form.endereco_execucao} onChange={e => set('endereco_execucao', e.target.value)} maxLength={300} />
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

                {/* Toggles */}
                <div className="space-y-1.5 flex items-end gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.carbono_zero} onCheckedChange={v => set('carbono_zero', v)} />
                    <Label>Carbono Zero?</Label>
                  </div>
                </div>
                <div className="space-y-1.5 flex items-end gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.cortex} onCheckedChange={v => set('cortex', v)} />
                    <Label>Cortex?</Label>
                  </div>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="estudo_equipe">Há um estudo de equipe já definido?</Label>
                  <Textarea id="estudo_equipe" value={form.estudo_equipe} onChange={e => set('estudo_equipe', e.target.value)} maxLength={500} rows={2} placeholder="Descreva o estudo de equipe, se houver..." />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="scope">Descrição do negócio / serviços</Label>
                  <Textarea id="scope" value={form.scope} onChange={e => set('scope', e.target.value)} maxLength={2000} rows={3} placeholder="Descreva o escopo dos serviços solicitados..." />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Data de Entrega Desejada</Label>
                  <SmartDatePicker
                    value={form.target_delivery_date}
                    onChange={v => set('target_delivery_date', v)}
                    onEstimatorSelected={(eid) => set('orcamentista_id', eid)}
                    placeholder="Selecionar data desejada"
                  />
                </div>
              </div>
            </CardContent>
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
