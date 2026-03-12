import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/NativeSelect';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useQueryClient } from '@tanstack/react-query';
import { useCustomProperties } from '@/hooks/useCustomProperties';
import { DatePickerField } from '@/components/DatePickerField';
import { SmartDatePicker } from '@/components/SmartDatePicker';
import { DynamicFields, saveCustomPropertyValues } from '@/components/DynamicFields';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useOrigins } from '@/components/settings/OriginsTab';
import { useQualificationQuestions } from '@/components/settings/QualificationTab';
import { QualificationForm, calculateScore } from '@/components/QualificationForm';
import { useEstimatorWorkload } from '@/components/EstimatorGantt';

const CONTRACT_TYPES = [
  { value: 'recorrente', label: 'Recorrente' },
  { value: 'nao_recorrente', label: 'Não Recorrente' },
];
const MARKETS = [
  { value: 'publico', label: 'Público' },
  { value: 'privado', label: 'Privado' },
];
const BUSINESS_AREAS = [
  { value: 'infraestrutura_predial', label: 'Infraestrutura Predial' },
  { value: 'missao_critica', label: 'Missão Crítica' },
  { value: 'seguranca_eletronica', label: 'Segurança Eletrônica' },
  { value: 'inteligencia_predial', label: 'Inteligência Predial' },
  { value: 'energia', label: 'Energia' },
  { value: 'outro', label: 'Outro' },
];

export function NewDealModal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: stagesData = [] } = useFunnelStages();
  const { data: origins = [] } = useOrigins();
  const { data: qualQuestions = [] } = useQualificationQuestions();
  const STAGES = stagesData.filter(s => s.stage_type !== 'lost').map(s => ({ value: s.key, label: s.label }));
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [form, setForm] = useState({
    name: '',
    value: '',
    stage: '',
    close_date: '',
    company_id: '',
    contact_id: '',
    orcamentista_id: '',
    contract_type: '',
    market: '',
    business_area: '',
    origin_id: '',
    scope: '',
    budget_start_date: '',
    proposal_delivery_date: '',
    target_delivery_date: '',
  });
  const [qualAnswers, setQualAnswers] = useState<Record<string, string>>({});
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { data: customProps = [] } = useCustomProperties('deals');
  const { data: workloadMap = {} } = useEstimatorWorkload();
  const isBudgetStage = useMemo(() => {
    const selectedStage = stagesData.find(s => s.key === form.stage);
    return !!(selectedStage?.key?.includes('orcamento') || selectedStage?.label?.toLowerCase().includes('orçamento'));
  }, [stagesData, form.stage]);

  useEffect(() => {
    if (open && STAGES.length > 0 && !form.stage) {
      setForm(f => ({ ...f, stage: STAGES[0].value }));
    }
  }, [open, STAGES]);

  useEffect(() => {
    if (open) {
      supabase.from('companies').select('id, name').order('name').then(({ data }) => {
        if (data) setCompanies(data);
      });
      supabase.from('profiles').select('user_id, full_name').then(({ data }) => {
        if (data) setProfiles(data);
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

  const selectedCompanyName = companies.find(c => c.id === form.company_id)?.name || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    // Generate proposal_id via DB function
    const { data: proposalData } = await supabase.rpc('generate_proposal_id', { company_name: selectedCompanyName });
    const proposalId = proposalData || '';

    // Calculate qualification score
    const score = calculateScore(qualQuestions, qualAnswers);

    const { data, error } = await supabase.from('deals').insert({
      name: form.name,
      value: parseFloat(form.value) || 0,
      stage: form.stage,
      close_date: form.close_date || null,
      company_id: form.company_id,
      contact_id: form.contact_id || null,
      owner_id: user.id,
      proposal_id: proposalId,
      orcamentista_id: form.orcamentista_id || null,
      contract_type: form.contract_type || null,
      market: form.market || null,
      business_area: form.business_area || null,
      origin_id: form.origin_id || null,
      qualification_score: score,
      scope: form.scope || null,
      budget_start_date: form.budget_start_date || null,
      proposal_delivery_date: form.proposal_delivery_date || null,
      target_delivery_date: form.target_delivery_date || null,
      approval_status: 'pending',
    } as any).select('id').single();

    if (error) {
      toast.error('Erro ao criar negócio: ' + error.message);
      setLoading(false);
      return;
    }
    if (data) {
      // Save custom property values
      if (Object.keys(customValues).length > 0) {
        await saveCustomPropertyValues(data.id, customValues, supabase);
      }
      // Save qualification answers
      const activeQs = qualQuestions.filter(q => q.is_active);
      for (const q of activeQs) {
        const answer = qualAnswers[q.id];
        if (!answer) continue;
        const options = (q.options as { label: string; score: number }[]) || [];
        const matched = options.find(o => o.label === answer);
        await supabase.from('deal_qualification_answers').insert({
          deal_id: data.id,
          question_id: q.id,
          answer,
          score: matched ? matched.score : 0,
        } as any);
      }
      // Add orcamentista as follower
      if (form.orcamentista_id) {
        await supabase.from('deal_followers').insert({ deal_id: data.id, user_id: form.orcamentista_id } as any);
      }
      // Notify Gerência of Orçamentos team for approval
      try {
        const { data: orcTeam } = await supabase.from('teams').select('id').eq('name', 'Orçamentos').maybeSingle();
        if (orcTeam) {
          const { data: teamMembers } = await supabase.from('team_members').select('user_id').eq('team_id', orcTeam.id);
          if (teamMembers) {
            for (const tm of teamMembers) {
              const { data: hasGerencia } = await supabase.rpc('has_role', { _user_id: tm.user_id, _role: 'gerencia' });
              if (hasGerencia) {
                await supabase.from('notifications').insert({
                  user_id: tm.user_id,
                  type: 'approval_request',
                  title: `Aprovação pendente: ${form.name}`,
                  description: `Novo negócio aguarda aprovação de orçamento.`,
                  entity_type: 'deal',
                  entity_id: data.id,
                } as any);
              }
            }
          }
        }
      } catch (_) { /* non-blocking */ }
    }
    setLoading(false);
    toast.success('Negócio criado!');
    queryClient.invalidateQueries({ queryKey: ['deals'] });
    setOpen(false);
    setForm({ name: '', value: '', stage: '', close_date: '', company_id: '', contact_id: '', orcamentista_id: '', contract_type: '', market: '', business_area: '', origin_id: '', scope: '', budget_start_date: '', proposal_delivery_date: '', target_delivery_date: '' });
    setCustomValues({});
    setQualAnswers({});
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Negócio
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Negócio</DialogTitle>
        </DialogHeader>
        {STAGES.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Proposal ID preview */}
          {selectedCompanyName && (
            <div className="bg-muted/50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">ID da Proposta (gerado automaticamente)</p>
              <p className="text-sm font-mono font-semibold text-primary">D{new Date().getFullYear().toString().slice(-2)}_XXXXX_{selectedCompanyName.replace(/\s/g, '')}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome do negócio</Label>
            <Input placeholder="Nome do negócio" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
              <Input type="number" step="0.01" placeholder="Valor (R$)" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Etapa</Label>
              <NativeSelect value={form.stage} onChange={(v) => setForm({ ...form, stage: v })} options={STAGES} placeholder="Selecione a etapa" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dados de Orçamentos</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Orçamentista Responsável</Label>
                <Select value={form.orcamentista_id} onValueChange={(v) => setForm({ ...form, orcamentista_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => {
                      const count = workloadMap[p.user_id] || 0;
                      return (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          <span className="flex items-center justify-between w-full gap-2">
                            <span>{p.full_name || p.user_id}</span>
                            {count > 0 && <span className="text-[10px] text-muted-foreground ml-1">({count} {count === 1 ? 'projeto ativo' : 'projetos ativos'})</span>}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipo de Contrato</Label>
                <Select value={form.contract_type} onValueChange={(v) => setForm({ ...form, contract_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map(ct => <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Mercado</Label>
                <Select value={form.market} onValueChange={(v) => setForm({ ...form, market: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {MARKETS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Área de Negócio</Label>
                <Select value={form.business_area} onValueChange={(v) => setForm({ ...form, business_area: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {BUSINESS_AREAS.map(ba => <SelectItem key={ba.value} value={ba.value}>{ba.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Origem</Label>
                <Select value={form.origin_id} onValueChange={(v) => setForm({ ...form, origin_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {origins.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data de Fechamento</Label>
                <DatePickerField value={form.close_date} onChange={(v) => setForm({ ...form, close_date: v })} placeholder="Selecionar data" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data Início Orçamento</Label>
                <DatePickerField value={form.budget_start_date} onChange={(v) => setForm({ ...form, budget_start_date: v })} placeholder="Selecionar data" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data Entrega Proposta</Label>
                <DatePickerField value={form.proposal_delivery_date} onChange={(v) => setForm({ ...form, proposal_delivery_date: v })} placeholder="Selecionar data" />
              </div>
              {isBudgetStage && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Data de Entrega Desejada</Label>
                  <SmartDatePicker
                    value={form.target_delivery_date}
                    onChange={(v) => setForm({ ...form, target_delivery_date: v })}
                    estimatorId={form.orcamentista_id || undefined}
                    placeholder="Selecionar data"
                  />
                </div>
              )}
            </div>
            <div className="space-y-1.5 mt-3">
              <Label className="text-xs text-muted-foreground">Escopo</Label>
              <Textarea placeholder="Descreva o escopo do projeto..." value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} rows={3} />
            </div>
          </div>

          {/* Qualification Questions */}
          {qualQuestions.filter(q => q.is_active).length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Qualificação do Negócio</p>
              <QualificationForm questions={qualQuestions} answers={qualAnswers} onChange={setQualAnswers} />
            </div>
          )}

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
        )}
      </DialogContent>
    </Dialog>
  );
}
