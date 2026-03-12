import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Building2, DollarSign, Calendar, AlertTriangle } from 'lucide-react';
import { LossReasonModal } from '@/components/LossReasonModal';
import { ProfitMarginModal } from '@/components/ProfitMarginModal';
import { StarRating } from '@/components/StarRating';
import { notifyDealFollowers } from '@/components/DealFollowers';
import { toast } from '@/components/ui/sonner';
import confetti from 'canvas-confetti';
import type { Filters } from '@/components/AdvancedFilters';

type Deal = {
  id: string;
  name: string;
  value: number | null;
  stage: string;
  close_date: string | null;
  updated_at: string;
  company_id: string;
  owner_id: string;
  created_at: string;
  loss_reason: string | null;
  proposal_id: string | null;
  qualification_score: number | null;
  profit_margin: number | null;
  companies: { name: string } | null;
};

type Props = {
  filters?: Filters;
};

function fireConfetti() {
  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.6 },
    colors: ['hsl(190,35%,45%)', 'hsl(150,40%,45%)', 'hsl(38,85%,50%)', '#fff'],
  });
}

export function KanbanBoard({ filters = {} }: Props) {
  const { user, role: userRole } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: ALL_STAGES = [] } = useFunnelStages();
  const STAGES = userRole ? ALL_STAGES.filter(s => s.allowed_roles?.includes(userRole)) : ALL_STAGES;
  const [lossModal, setLossModal] = useState<{ dealId: string; dealName: string } | null>(null);
  const [profitModal, setProfitModal] = useState<{ dealId: string; dealName: string; dealValue: number; targetStage: string } | null>(null);

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals', filters],
    queryFn: async () => {
      let q = supabase
        .from('deals')
        .select('id, name, value, stage, close_date, updated_at, created_at, company_id, owner_id, loss_reason, proposal_id, qualification_score, profit_margin, companies(name)')
        .order('created_at', { ascending: false });

      if (filters.ownerId === 'mine' && user) q = q.eq('owner_id', user.id);
      if (filters.createdAfter) q = q.gte('created_at', filters.createdAfter);
      if (filters.createdBefore) q = q.lte('created_at', filters.createdBefore + 'T23:59:59');
      if (filters.minValue) q = q.gte('value', Number(filters.minValue));
      if (filters.maxValue) q = q.lte('value', Number(filters.maxValue));
      if ((filters as any).minStars) {
        const minScore = (Number((filters as any).minStars) - 1) * 20 + 1;
        q = q.gte('qualification_score', minScore);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Deal[];
    },
  });

  // Fetch tasks for follow-up & overdue badges
  const { data: dealTasks = [] } = useQuery({
    queryKey: ['kanban-tasks'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('id, deal_id, completed, due_date')
        .not('deal_id', 'is', null);
      return data || [];
    },
  });

  const todayStr = new Date().toISOString().split('T')[0];

  // Pre-compute per-deal task info
  const dealTaskInfo = (() => {
    const info: Record<string, { hasFutureTasks: boolean; hasOverdue: boolean }> = {};
    for (const d of deals) {
      const tasks = dealTasks.filter(t => t.deal_id === d.id);
      const pendingTasks = tasks.filter(t => !t.completed);
      const hasFutureTasks = pendingTasks.some(t => t.due_date && t.due_date >= todayStr);
      const hasOverdue = pendingTasks.some(t => t.due_date && t.due_date < todayStr);
      info[d.id] = { hasFutureTasks: hasFutureTasks || (pendingTasks.length > 0 && pendingTasks.every(t => !t.due_date)), hasOverdue };
    }
    return info;
  })();

  const ownerIds = [...new Set(deals.map((d) => d.owner_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles', ownerIds],
    queryFn: async () => {
      if (ownerIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ownerIds);
      return data || [];
    },
    enabled: ownerIds.length > 0,
  });

  const getOwnerInitials = (ownerId: string) => {
    const profile = profiles.find((p) => p.user_id === ownerId);
    if (!profile?.full_name) return '?';
    return profile.full_name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData('dealId', dealId);
  };

  const moveDeal = async (dealId: string, stage: string, lossReason?: string, profitMargin?: number) => {
    const deal = deals.find(d => d.id === dealId);
    const oldStage = deal?.stage || '';
    const updateData: any = { stage };
    if (lossReason) updateData.loss_reason = lossReason;
    if (profitMargin !== undefined) updateData.profit_margin = profitMargin;
    const targetStage = STAGES.find(s => s.key === stage);
    if (targetStage?.stage_type === 'won') updateData.loss_reason = null;

    await supabase.from('deals').update(updateData).eq('id', dealId);
    queryClient.invalidateQueries({ queryKey: ['deals'] });

    if (targetStage?.stage_type === 'won') {
      fireConfetti();
      toast('🎉 Negócio Fechado!', { description: 'Parabéns pela conquista!' });
    }

    const stageLabelsMap: Record<string, string> = {};
    STAGES.forEach(s => { stageLabelsMap[s.key] = s.label; });
    const myName = profiles.find(p => p.user_id === user?.id)?.full_name || 'Alguém';
    await notifyDealFollowers(
      dealId,
      'deal_stage_changed',
      `Negócio "${deal?.name}" mudou de estágio`,
      `${myName} moveu de ${stageLabelsMap[oldStage] || oldStage} → ${stageLabelsMap[stage] || stage}`,
      user?.id
    );
  };

  const handleDrop = async (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('dealId');
    const deal = deals.find(d => d.id === dealId);
    const targetStage = STAGES.find(s => s.key === stageKey);

    if (targetStage?.stage_type === 'lost') {
      setLossModal({ dealId, dealName: deal?.name || '' });
      return;
    }

    if (targetStage?.stage_type === 'won' && deal && !deal.profit_margin) {
      setProfitModal({ dealId, dealName: deal.name, dealValue: deal.value || 0, targetStage: stageKey });
      return;
    }

    await moveDeal(dealId, stageKey);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const formatCurrency = (val: number | null) =>
    val != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : '-';

  const getInactivityDays = (updatedAt: string) =>
    Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));

  const getCardBorderClass = (deal: Deal, stageType: string) => {
    if (stageType === 'won' || stageType === 'lost') return 'border-border';
    const days = getInactivityDays(deal.updated_at);
    if (days > 10) return 'border-destructive border-2';
    if (days > 3) return 'border-warning border-2';
    return 'border-border';
  };

  const getHealthColor = (updatedAt: string) => {
    const days = getInactivityDays(updatedAt);
    if (days <= 3) return 'bg-emerald-500';
    if (days <= 7) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage === stage.key);
          const total = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);

          return (
            <div
              key={stage.key}
              className="flex-shrink-0 w-72"
              onDrop={(e) => handleDrop(e, stage.key)}
              onDragOver={handleDragOver}
            >
              <div className={`rounded-t-xl px-4 py-3 ${stage.color}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-foreground">{stage.label}</h3>
                  <Badge variant="secondary" className="text-xs">{stageDeals.length}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{formatCurrency(total)}</p>
              </div>
              <div className="space-y-2 min-h-[200px] bg-muted/30 rounded-b-xl p-2">
                {stageDeals.map((deal) => {
                  const taskInfo = dealTaskInfo[deal.id];
                  const isActive = stage.stage_type === 'active';
                  const showNoFollowUp = isActive && taskInfo && !taskInfo.hasFutureTasks;
                  const showOverdue = taskInfo?.hasOverdue;
                  const borderClass = getCardBorderClass(deal, stage.stage_type);

                  return (
                    <Card
                      key={deal.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, deal.id)}
                      onClick={() => navigate(`/deals/${deal.id}`)}
                      className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-200 ${borderClass}`}
                    >
                      <CardContent className="p-3 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {deal.proposal_id && (
                              <p className="text-[10px] font-mono text-muted-foreground truncate">{deal.proposal_id}</p>
                            )}
                            <p className="font-bold text-sm text-card-foreground leading-tight">{deal.name}</p>
                          </div>
                          <span
                            className={`flex-shrink-0 mt-1 h-2.5 w-2.5 rounded-full ${getHealthColor(deal.updated_at)}`}
                            title={`Última atualização: ${new Date(deal.updated_at).toLocaleDateString('pt-BR')} (${getInactivityDays(deal.updated_at)}d atrás)`}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{deal.companies?.name || '-'}</span>
                        </div>
                        {(deal.qualification_score ?? 0) > 0 && (
                          <StarRating score={deal.qualification_score || 0} />
                        )}
                        {/* Alert badges */}
                        {(showNoFollowUp || showOverdue || (deal.loss_reason && stage.stage_type === 'lost')) && (
                          <div className="flex flex-wrap gap-1">
                            {showNoFollowUp && (
                              <Badge variant="outline" className="text-[10px] border-warning text-warning gap-1">
                                <AlertTriangle className="h-2.5 w-2.5" />Sem follow-up
                              </Badge>
                            )}
                            {showOverdue && (
                              <Badge variant="destructive" className="text-[10px] gap-1">
                                Tarefa atrasada
                              </Badge>
                            )}
                            {deal.loss_reason && stage.stage_type === 'lost' && (
                              <Badge variant="destructive" className="text-[10px]">
                                {deal.loss_reason}
                              </Badge>
                            )}
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1 font-semibold text-primary">
                              <DollarSign className="h-3 w-3" />
                              {formatCurrency(deal.value)}
                            </span>
                            {deal.close_date && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {new Date(deal.close_date).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                              {getOwnerInitials(deal.owner_id)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <LossReasonModal
        open={!!lossModal}
        dealName={lossModal?.dealName}
        onCancel={() => setLossModal(null)}
        onConfirm={async (reason) => {
          if (lossModal) {
            const lostStage = STAGES.find(s => s.stage_type === 'lost');
            await moveDeal(lossModal.dealId, lostStage?.key || 'perdido', reason);
            setLossModal(null);
          }
        }}
      />

      <ProfitMarginModal
        open={!!profitModal}
        dealName={profitModal?.dealName}
        dealValue={profitModal?.dealValue}
        onCancel={() => setProfitModal(null)}
        onConfirm={async (margin) => {
          if (profitModal) {
            await moveDeal(profitModal.dealId, profitModal.targetStage, undefined, margin);
            setProfitModal(null);
          }
        }}
      />
    </>
  );
}
