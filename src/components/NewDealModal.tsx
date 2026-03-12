// Native selects - no Radix
import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/NativeSelect';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useQueryClient } from '@tanstack/react-query';
import { useCustomProperties } from '@/hooks/useCustomProperties';
import { SmartDatePicker } from '@/components/SmartDatePicker';
import { DynamicFields, saveCustomPropertyValues } from '@/components/DynamicFields';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useOrigins } from '@/components/settings/OriginsTab';
import { useQualificationQuestions } from '@/components/settings/QualificationTab';
import { QualificationForm, calculateScore } from '@/components/QualificationForm';

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
const TIPO_NEGOCIO_OPTIONS = [
  { value: 'novo_cliente', label: 'Novo Cliente' },
  { value: 'cliente_existente', label: 'Cliente Existente' },
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
  const [form, setForm] = useState({
    name: '',
    value: '',
    stage: '',
    close_date: '',
    company_id: '',
    contact_id: '',
    contract_type: '',
    market: '',
    business_area: '',
    origin_id: '',
    scope: '',
    budget_start_date: '',
    proposal_delivery_date: '',
    target_delivery_date: '',
    orcamentista_id: '',
    // New fields
    carbono_zero: false,
    cortex: false,
    endereco_execucao: '',
    estudo_equipe: '',
    tipo_negocio: '',
    vendedor_externo: '',
  });
  const [qualAnswers, setQualAnswers] = useState<Record<string, string>>({});
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { data: customProps = [] } = useCustomProperties('deals');

  // Detect if selected stage is "Orçamentos" type
  const isBudgetStage = useMemo(() => {
    const selectedStage = stagesData.find(s => s.key === form.stage);
    if (!selectedStage) return false;
    const k = selectedStage.key?.toLowerCase() || '';
    const l = selectedStage.label?.toLowerCase() || '';
    return k.includes('orcamento') || l.includes('orçamento') || k.includes('proposta') || l.includes('proposta');
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

    const { data: proposalData } = await supabase.rpc('generate_proposal_id', { company_name: selectedCompanyName });
    const proposalId = proposalData || '';
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
      // New fields (only if budget stage)
      carbono_zero: isBudgetStage ? form.carbono_zero : false,
      cortex: isBudgetStage ? form.cortex : false,
      endereco_execucao: isBudgetStage ? (form.endereco_execucao || null) : null,
      estudo_equipe: isBudgetStage ? (form.estudo_equipe || null) : null,
      tipo_negocio: isBudgetStage ? (form.tipo_negocio || null) : null,
      vendedor_externo: isBudgetStage ? (form.vendedor_externo || null) : null,
    } as any).select('id').single();

    if (error) {
      toast.error('Erro ao criar negócio: ' + error.message);
      setLoading(false);
      return;
    }
    if (data) {
      if (Object.keys(customValues).length > 0) {
        await saveCustomPropertyValues(data.id, customValues, supabase);
      }
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
    setForm({ name: '', value: '', stage: '', close_date: '', company_id: '', contact_id: '', contract_type: '', market: '', business_area: '', origin_id: '', scope: '', budget_start_date: '', proposal_delivery_date: '', target_delivery_date: '', orcamentista_id: '', carbono_zero: false, cortex: false, endereco_execucao: '', estudo_equipe: '', tipo_negocio: '', vendedor_externo: '' });
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
              <NativeSelect value={form.company_id} onChange={(v) => setForm({ ...form, company_id: v, contact_id: '' })} options={companies.map(c => ({ value: c.id, label: c.name }))} placeholder="Selecione a empresa" />
            </div>
            {contacts.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Contato</Label>
                <NativeSelect value={form.contact_id} onChange={(v) => setForm({ ...form, contact_id: v })} options={contacts.map(c => ({ value: c.id, label: c.name }))} placeholder="Selecione o contato" />
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dados de Orçamentos</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipo de Contrato</Label>
                <NativeSelect value={form.contract_type} onChange={(v) => setForm({ ...form, contract_type: v })} options={CONTRACT_TYPES} placeholder="Selecione..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Mercado</Label>
                <NativeSelect value={form.market} onChange={(v) => setForm({ ...form, market: v })} options={MARKETS} placeholder="Selecione..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Área de Negócio</Label>
                <NativeSelect value={form.business_area} onChange={(v) => setForm({ ...form, business_area: v })} options={BUSINESS_AREAS} placeholder="Selecione..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Origem</Label>
                <NativeSelect value={form.origin_id} onChange={(v) => setForm({ ...form, origin_id: v })} options={origins.map(o => ({ value: o.id, label: o.label }))} placeholder="Selecione..." />
              </div>
              {isBudgetStage && (
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs text-muted-foreground">Data Entrega Proposta</Label>
                  <SmartDatePicker
                    value={form.proposal_delivery_date}
                    onChange={(v) => setForm({ ...form, proposal_delivery_date: v })}
                    onEstimatorSelected={(eid) => setForm(f => ({ ...f, orcamentista_id: eid }))}
                    placeholder="Selecionar data"
                  />
                </div>
              )}
            </div>

            {/* Conditional fields - only visible for budget/orçamento stages */}
            {isBudgetStage && (
              <div className="mt-4 space-y-3 border-t border-border/50 pt-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Campos de Orçamento</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 flex items-end gap-2">
                    <div className="flex items-center gap-2">
                      <Switch checked={form.carbono_zero} onCheckedChange={v => setForm(f => ({ ...f, carbono_zero: v }))} />
                      <Label className="text-xs text-muted-foreground">Carbono Zero?</Label>
                    </div>
                  </div>
                  <div className="space-y-1.5 flex items-end gap-2">
                    <div className="flex items-center gap-2">
                      <Switch checked={form.cortex} onCheckedChange={v => setForm(f => ({ ...f, cortex: v }))} />
                      <Label className="text-xs text-muted-foreground">Cortex?</Label>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Tipo de Negócio</Label>
                    <NativeSelect value={form.tipo_negocio} onChange={v => setForm(f => ({ ...f, tipo_negocio: v }))} options={TIPO_NEGOCIO_OPTIONS} placeholder="Selecione..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Vendedor Externo</Label>
                    <Input value={form.vendedor_externo} onChange={e => setForm(f => ({ ...f, vendedor_externo: e.target.value }))} placeholder="Nome do vendedor" maxLength={100} />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs text-muted-foreground">Endereço de Execução</Label>
                    <Input value={form.endereco_execucao} onChange={e => setForm(f => ({ ...f, endereco_execucao: e.target.value }))} placeholder="Endereço dos serviços" maxLength={300} />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs text-muted-foreground">Estudo de Equipe</Label>
                    <Textarea value={form.estudo_equipe} onChange={e => setForm(f => ({ ...f, estudo_equipe: e.target.value }))} placeholder="Descreva o estudo de equipe..." rows={2} maxLength={500} />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5 mt-3">
              {isBudgetStage && (
                <>
                  <Label className="text-xs text-muted-foreground">Escopo</Label>
                  <Textarea placeholder="Descreva o escopo do projeto..." value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} rows={3} />
                </>
              )}
            </div>
          </div>

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
