import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCustomProperties, useCustomPropertyValues } from '@/hooks/useCustomProperties';
import { TasksChecklist } from '@/components/TasksChecklist';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { DynamicFields } from '@/components/DynamicFields';
import { InlineEdit } from '@/components/InlineEdit';
import { DealFollowers } from '@/components/DealFollowers';
import { CommentBox } from '@/components/CommentBox';
import { FileManager } from '@/components/FileManager';
import { LossReasonModal } from '@/components/LossReasonModal';
import { ProfitMarginModal } from '@/components/ProfitMarginModal';
import { StarRating } from '@/components/StarRating';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import {
  ArrowLeft, Building2, DollarSign, Calendar, Clock, Layers, Eye,
  Activity, ListTodo, MessageCircle, Paperclip, Users, Trash2,
  Trophy, XCircle, Percent, FileText,
} from 'lucide-react';
import { useFunnelStages } from '@/hooks/useFunnelStages';

const CONTRACT_TYPE_LABELS: Record<string, string> = { recorrente: 'Recorrente', nao_recorrente: 'Não Recorrente' };
const MARKET_LABELS: Record<string, string> = { publico: 'Público', privado: 'Privado' };
const BUSINESS_AREA_LABELS: Record<string, string> = {
  infraestrutura_predial: 'Infraestrutura Predial', missao_critica: 'Missão Crítica',
  seguranca_eletronica: 'Segurança Eletrônica', inteligencia_predial: 'Inteligência Predial',
  energia: 'Energia', outro: 'Outro',
};

function fireConfetti() {
  confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['hsl(190,35%,45%)', 'hsl(150,40%,45%)', 'hsl(38,85%,50%)', '#fff'] });
}

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role: userRole } = useAuth();
  const queryClient = useQueryClient();
  const { data: stagesData = [] } = useFunnelStages();
  const stageLabels: Record<string, string> = {};
  const stageColors: Record<string, string> = {};
  stagesData.forEach(s => { stageLabels[s.key] = s.label; stageColors[s.key] = s.color; });
  const STAGES = stagesData.map(s => s.key);

  const wonStage = stagesData.find(s => s.stage_type === 'won');
  const lostStage = stagesData.find(s => s.stage_type === 'lost');

  const [activityOpen, setActivityOpen] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'meeting', title: '', description: '' });
  const [activitySaving, setActivitySaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [lossModalOpen, setLossModalOpen] = useState(false);
  const [profitModalOpen, setProfitModalOpen] = useState(false);

  const { data: customProps = [] } = useCustomProperties('deals');
  const { data: customValues = {} } = useCustomPropertyValues(id);

  const { data: deal } = useQuery({
    queryKey: ['deal', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*, companies(id, name)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: contact } = useQuery({
    queryKey: ['deal-contact', deal?.contact_id],
    queryFn: async () => {
      if (!deal?.contact_id) return null;
      const { data } = await supabase.from('contacts').select('id, name, email, role').eq('id', deal.contact_id).single();
      return data;
    },
    enabled: !!deal?.contact_id,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['deal-activities', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('activities').select('*').eq('company_id', deal?.company_id!).order('activity_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!deal?.company_id,
  });

  const { data: profilesMap = {} } = useQuery({
    queryKey: ['profiles-map'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      const map: Record<string, string> = {};
      (data || []).forEach((p) => { if (p.full_name) map[p.user_id] = p.full_name; });
      return map;
    },
  });

  const { data: originLabel } = useQuery({
    queryKey: ['deal-origin', (deal as any)?.origin_id],
    queryFn: async () => {
      const oid = (deal as any)?.origin_id;
      if (!oid) return null;
      const { data } = await supabase.from('deal_origins').select('label').eq('id', oid).single();
      return data?.label || null;
    },
    enabled: !!(deal as any)?.origin_id,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['deal', id] });
    queryClient.invalidateQueries({ queryKey: ['deal-activities', id] });
    queryClient.invalidateQueries({ queryKey: ['deals'] });
  };

  const handleInlineEdit = async (field: string, label: string, oldValue: string, newValue: string) => {
    if (!user || !id || newValue === oldValue) return;
    const updateData: any = { [field]: newValue || null };
    if (field === 'value' || field === 'profit_margin') updateData[field] = Number(newValue) || 0;
    const { error } = await supabase.from('deals').update(updateData).eq('id', id);
    if (error) { toast.error('Erro ao salvar'); return; }
    await supabase.from('activities').insert({
      type: 'property_changed',
      title: `Alterou "${label}"`,
      description: `De "${oldValue || '(vazio)'}" para "${newValue || '(vazio)'}"`,
      company_id: deal?.company_id || null,
      created_by: user.id,
    });
    invalidateAll();
    toast.success('Atualizado!');
  };

  const handleStageChange = async (newStage: string) => {
    if (!user || !id || !deal) return;
    const targetStage = stagesData.find(s => s.key === newStage);
    if (targetStage?.stage_type === 'lost') {
      setLossModalOpen(true);
      return;
    }
    // Check profit margin for won
    if (targetStage?.stage_type === 'won' && !(deal as any).profit_margin) {
      setProfitModalOpen(true);
      return;
    }
    const oldStage = deal.stage;
    const updateData: any = { stage: newStage, loss_reason: null };
    const { error } = await supabase.from('deals').update(updateData).eq('id', id);
    if (error) { toast.error('Erro ao salvar'); return; }
    await supabase.from('activities').insert({
      type: 'property_changed',
      title: `Moveu estágio`,
      description: `De "${stageLabels[oldStage] || oldStage}" para "${stageLabels[newStage] || newStage}"`,
      company_id: deal.company_id,
      created_by: user.id,
    });
    if (targetStage?.stage_type === 'won') fireConfetti();
    invalidateAll();
    toast.success(targetStage?.stage_type === 'won' ? '🎉 Negócio ganho!' : 'Estágio atualizado!');
  };

  const handleMarkWon = async () => {
    if (!user || !id || !deal) return;
    // Check profit margin
    if (!(deal as any).profit_margin) {
      setProfitModalOpen(true);
      return;
    }
    const wonKey = wonStage?.key;
    if (wonKey) {
      await handleStageChange(wonKey);
    } else {
      const { error } = await supabase.from('deals').update({ stage: '__won__', loss_reason: null } as any).eq('id', id);
      if (error) { toast.error('Erro ao salvar'); return; }
      await supabase.from('activities').insert({
        type: 'deal_won', title: 'Negócio marcado como Ganho',
        description: `Negócio "${deal.name}" foi marcado como ganho`,
        company_id: deal.company_id, created_by: user.id,
      });
      fireConfetti();
      invalidateAll();
      toast.success('🎉 Negócio ganho!');
    }
  };

  const handleMarkLost = () => setLossModalOpen(true);

  const handleProfitConfirm = async (margin: number) => {
    if (!user || !id || !deal) return;
    // Save profit margin then proceed to won
    await supabase.from('deals').update({ profit_margin: margin } as any).eq('id', id);
    const wonKey = wonStage?.key || '__won__';
    const { error } = await supabase.from('deals').update({ stage: wonKey, loss_reason: null } as any).eq('id', id);
    if (error) { toast.error('Erro ao salvar'); return; }
    await supabase.from('activities').insert({
      type: 'deal_won', title: 'Negócio marcado como Ganho',
      description: `Lucro: ${margin}% · Negócio "${deal.name}"`,
      company_id: deal.company_id, created_by: user.id,
    });
    fireConfetti();
    setProfitModalOpen(false);
    invalidateAll();
    toast.success('🎉 Negócio ganho!');
  };

  const handleLossConfirm = async (reason: string) => {
    if (!user || !id || !deal) return;
    const lostKey = lostStage?.key || '__lost__';
    const { error } = await supabase.from('deals').update({ stage: lostKey, loss_reason: reason } as any).eq('id', id);
    if (error) { toast.error('Erro ao salvar'); return; }
    await supabase.from('activities').insert({
      type: 'deal_lost', title: 'Negócio marcado como Perdido',
      description: `Motivo: ${reason}`, company_id: deal.company_id, created_by: user.id,
    });
    setLossModalOpen(false);
    invalidateAll();
    toast.success('Negócio marcado como perdido.');
  };

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || !deal) return;
    setActivitySaving(true);
    const { error } = await supabase.from('activities').insert({
      type: activityForm.type, title: activityForm.title.trim(),
      description: activityForm.description.trim() || null,
      company_id: deal.company_id, created_by: user.id,
    });
    setActivitySaving(false);
    if (error) { toast.error('Erro ao registrar atividade'); return; }
    toast.success('Atividade registrada!');
    setActivityForm({ type: 'meeting', title: '', description: '' });
    setActivityOpen(false);
    invalidateAll();
  };

  const handleDelete = async () => {
    if (!id) return;
    const { error } = await supabase.from('deals').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir negócio'); return; }
    toast.success('Negócio excluído!');
    navigate('/');
  };

  if (!deal) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const company = deal.companies as { id: string; name: string } | null;
  const formatCurrency = (v: number | null) => v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '-';
  const currentStageData = stagesData.find(s => s.key === deal.stage);
  const isDealClosed = currentStageData?.stage_type === 'won' || currentStageData?.stage_type === 'lost' || deal.stage === '__won__' || deal.stage === '__lost__';
  const dealAny = deal as any;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            {dealAny.proposal_id && (
              <p className="text-[10px] font-mono text-muted-foreground">{dealAny.proposal_id}</p>
            )}
            <h1 className="text-xl font-display font-bold text-foreground">{deal.name}</h1>
            <p className="text-xs text-muted-foreground">Negócio{company ? ` · ${company.name}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isDealClosed && (
            <>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleMarkWon}>
                <Trophy className="h-4 w-4 mr-1" />Marcar como Ganho
              </Button>
              <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleMarkLost}>
                <XCircle className="h-4 w-4 mr-1" />Marcar como Perdido
              </Button>
            </>
          )}
          <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-1" />Excluir
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader><DialogTitle>Confirmar Exclusão</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir o negócio "{deal.name}"? Esta ação não pode ser desfeita.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteConfirm(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-4">
        {/* LEFT: Properties */}
        <div className="space-y-3">
          <Accordion type="multiple" defaultValue={['basic', 'commercial', 'custom']}>
            <AccordionItem value="basic" className="border-border">
              <Card className="border-0 shadow-none">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Informações do Negócio</span>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="space-y-3 text-sm pt-0 px-4 pb-4">
                    <div>
                      <p className="text-muted-foreground text-xs">Nome</p>
                      <InlineEdit value={deal.name} onSave={(v) => handleInlineEdit('name', 'Nome', deal.name, v)} />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Valor</p>
                      <InlineEdit value={String(deal.value || 0)} onSave={(v) => handleInlineEdit('value', 'Valor', String(deal.value || 0), v)} icon={<DollarSign className="h-3 w-3 shrink-0 text-muted-foreground" />} />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Estágio</p>
                      <Select value={deal.stage} onValueChange={handleStageChange}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STAGES.map((s) => (
                            <SelectItem key={s} value={s}>{stageLabels[s] || s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Data de Fechamento</p>
                      <InlineEdit value={deal.close_date || ''} onSave={(v) => handleInlineEdit('close_date', 'Data de Fechamento', deal.close_date || '', v)} icon={<Calendar className="h-3 w-3 shrink-0 text-muted-foreground" />} />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Proprietário</p>
                      <p className="font-medium text-foreground text-sm">{profilesMap[deal.owner_id] || 'Desconhecido'}</p>
                    </div>
                    {(dealAny.qualification_score ?? 0) > 0 && (
                      <div>
                        <p className="text-muted-foreground text-xs">Qualificação</p>
                        <StarRating score={dealAny.qualification_score || 0} size="md" />
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground text-xs">Criado em</p>
                      <p className="font-medium text-foreground text-sm">{new Date(deal.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                    {deal.loss_reason && (
                      <div>
                        <p className="text-muted-foreground text-xs">Motivo de Perda</p>
                        <Badge variant="destructive" className="text-xs">{deal.loss_reason}</Badge>
                      </div>
                    )}
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            <AccordionItem value="commercial" className="border-border">
              <Card className="border-0 shadow-none">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3 w-3" />Informações Comerciais
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="space-y-3 text-sm pt-0 px-4 pb-4">
                    {dealAny.orcamentista_id && (
                      <div>
                        <p className="text-muted-foreground text-xs">Orçamentista Responsável</p>
                        <p className="font-medium text-foreground text-sm">{profilesMap[dealAny.orcamentista_id] || 'Desconhecido'}</p>
                      </div>
                    )}
                    {dealAny.contract_type && (
                      <div>
                        <p className="text-muted-foreground text-xs">Tipo de Contrato</p>
                        <Badge variant="secondary" className="text-xs">{CONTRACT_TYPE_LABELS[dealAny.contract_type] || dealAny.contract_type}</Badge>
                      </div>
                    )}
                    {dealAny.market && (
                      <div>
                        <p className="text-muted-foreground text-xs">Mercado</p>
                        <Badge variant="secondary" className="text-xs">{MARKET_LABELS[dealAny.market] || dealAny.market}</Badge>
                      </div>
                    )}
                    {dealAny.business_area && (
                      <div>
                        <p className="text-muted-foreground text-xs">Área de Negócio</p>
                        <Badge variant="secondary" className="text-xs">{BUSINESS_AREA_LABELS[dealAny.business_area] || dealAny.business_area}</Badge>
                      </div>
                    )}
                    {originLabel && (
                      <div>
                        <p className="text-muted-foreground text-xs">Origem</p>
                        <Badge variant="secondary" className="text-xs">{originLabel}</Badge>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground text-xs">Percentual de Lucro (%)</p>
                      <InlineEdit
                        value={String(dealAny.profit_margin || '')}
                        onSave={(v) => handleInlineEdit('profit_margin', 'Percentual de Lucro', String(dealAny.profit_margin || ''), v)}
                        icon={<Percent className="h-3 w-3 shrink-0 text-muted-foreground" />}
                      />
                    </div>
                    {dealAny.profit_margin && deal.value && (
                      <div className="bg-muted/50 rounded-lg p-2">
                        <p className="text-muted-foreground text-xs">Lucro Estimado</p>
                        <p className="font-bold text-primary text-sm">{formatCurrency((deal.value || 0) * (dealAny.profit_margin / 100))}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground text-xs">Data Início Orçamento</p>
                      <InlineEdit
                        value={dealAny.budget_start_date || ''}
                        onSave={(v) => handleInlineEdit('budget_start_date', 'Data Início Orçamento', dealAny.budget_start_date || '', v)}
                        icon={<Calendar className="h-3 w-3 shrink-0 text-muted-foreground" />}
                      />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Data Entrega Proposta</p>
                      <InlineEdit
                        value={dealAny.proposal_delivery_date || ''}
                        onSave={(v) => handleInlineEdit('proposal_delivery_date', 'Data Entrega Proposta', dealAny.proposal_delivery_date || '', v)}
                        icon={<Calendar className="h-3 w-3 shrink-0 text-muted-foreground" />}
                      />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Escopo</p>
                      <InlineEdit
                        value={dealAny.scope || ''}
                        onSave={(v) => handleInlineEdit('scope', 'Escopo', dealAny.scope || '', v)}
                      />
                    </div>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            {customProps.length > 0 && (
              <AccordionItem value="custom" className="border-border">
                <Card className="border-0 shadow-none">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Layers className="h-3 w-3" />Campos Customizados
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="pt-0 px-4 pb-4">
                      <DynamicFields properties={customProps} values={customValues} onChange={() => {}} readOnly />
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            )}
          </Accordion>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5"><Eye className="h-4 w-4" />Seguidores</CardTitle>
            </CardHeader>
            <CardContent>
              <DealFollowers dealId={id!} />
            </CardContent>
          </Card>
        </div>

        {/* CENTER: Timeline */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" />Histórico
            </h2>
            <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-xs"><Activity className="h-3.5 w-3.5 mr-1" />Log de Atividade</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Registrar Atividade</DialogTitle></DialogHeader>
                <form onSubmit={handleLogActivity} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={activityForm.type} onValueChange={(v) => setActivityForm({ ...activityForm, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="meeting">Reunião</SelectItem>
                        <SelectItem value="call">Chamada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input value={activityForm.title} onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })} placeholder="Ex: Call de negociação" required maxLength={100} />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea value={activityForm.description} onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })} placeholder="Detalhes..." rows={3} maxLength={1000} />
                  </div>
                  <Button type="submit" className="w-full" disabled={activitySaving}>{activitySaving ? 'Salvando...' : 'Registrar'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline" className="text-xs gap-1.5"><Clock className="h-3.5 w-3.5" />Timeline</TabsTrigger>
              <TabsTrigger value="comments" className="text-xs gap-1.5"><MessageCircle className="h-3.5 w-3.5" />Comentários</TabsTrigger>
              <TabsTrigger value="tasks" className="text-xs gap-1.5"><ListTodo className="h-3.5 w-3.5" />Tarefas</TabsTrigger>
              <TabsTrigger value="files" className="text-xs gap-1.5"><Paperclip className="h-3.5 w-3.5" />Arquivos</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline" className="mt-3"><ActivityTimeline activities={activities} profiles={profilesMap} /></TabsContent>
            <TabsContent value="comments" className="mt-3"><CommentBox entityType="deal" entityId={id!} /></TabsContent>
            <TabsContent value="tasks" className="mt-3"><TasksChecklist dealId={id} /></TabsContent>
            <TabsContent value="files" className="mt-3"><FileManager entityType="deal" entityId={id!} /></TabsContent>
          </Tabs>
        </div>

        {/* RIGHT: Associations */}
        <div className="space-y-4">
          {company && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5"><Building2 className="h-4 w-4" />Empresa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors duration-200" onClick={() => navigate(`/companies/${company.id}`)}>
                  <p className="text-sm font-medium text-primary">{company.name}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {contact && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5"><Users className="h-4 w-4" />Contato</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors duration-200" onClick={() => navigate(`/contacts/${contact.id}`)}>
                  <p className="text-sm font-medium text-primary">{contact.name}</p>
                  <p className="text-xs text-muted-foreground">{contact.role || contact.email || '-'}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Valor</span>
                <span className="font-semibold text-primary">{formatCurrency(deal.value)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Estágio</span>
                <Badge className={`text-[10px] ${stageColors[deal.stage] || ''}`}>{stageLabels[deal.stage] || deal.stage}</Badge>
              </div>
              {dealAny.profit_margin && deal.value && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">Lucro</span>
                  <span className="font-semibold text-emerald-600">{formatCurrency((deal.value || 0) * (dealAny.profit_margin / 100))}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Última atualização</span>
                <span className="text-xs text-muted-foreground">{new Date(deal.updated_at).toLocaleDateString('pt-BR')}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <LossReasonModal
        open={lossModalOpen}
        dealName={deal.name}
        onCancel={() => setLossModalOpen(false)}
        onConfirm={handleLossConfirm}
      />

      <ProfitMarginModal
        open={profitModalOpen}
        dealName={deal.name}
        dealValue={deal.value || 0}
        onCancel={() => setProfitModalOpen(false)}
        onConfirm={handleProfitConfirm}
      />
    </div>
  );
}
