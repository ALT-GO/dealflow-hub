import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Building2, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { LossReasonModal } from '@/components/LossReasonModal';
import { notifyDealFollowers } from '@/components/DealFollowers';
import { toast } from '@/components/ui/sonner';
import confetti from 'canvas-confetti';
import type { Filters } from '@/components/AdvancedFilters';

const STAGES = [
  { key: 'prospeccao', label: 'Prospecção', color: 'bg-muted' },
  { key: 'qualificacao', label: 'Qualificação', color: 'bg-secondary' },
  { key: 'proposta', label: 'Proposta', color: 'bg-accent/10' },
  { key: 'negociacao', label: 'Negociação', color: 'bg-warning/10' },
  { key: 'fechado', label: 'Fechado', color: 'bg-success/10' },
  { key: 'perdido', label: 'Perdido', color: 'bg-destructive/10' },
];

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [lossModal, setLossModal] = useState<{ dealId: string; dealName: string } | null>(null);

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals', filters],
    queryFn: async () => {
      let q = supabase
        .from('deals')
        .select('id, name, value, stage, close_date, updated_at, created_at, company_id, owner_id, loss_reason, companies(name)')
        .order('created_at', { ascending: false });

      if (filters.ownerId === 'mine' && user) q = q.eq('owner_id', user.id);
      if (filters.createdAfter) q = q.gte('created_at', filters.createdAfter);
      if (filters.createdBefore) q = q.lte('created_at', filters.createdBefore + 'T23:59:59');
      if (filters.minValue) q = q.gte('value', Number(filters.minValue));
      if (filters.maxValue) q = q.lte('value', Number(filters.maxValue));

      const { data, error } = await q;
      if (error) throw error;
      return data as Deal[];
    },
  });

  const { data: allDeals = [] } = useQuery({
    queryKey: ['deals-all-for-probability'],
    queryFn: async () => {
      const { data, error } = await supabase.from('deals').select('stage');
      if (error) throw error;
      return data;
    },
  });

  const stageProbability = (() => {
    const totalClosed = allDeals.filter(d => d.stage === 'fechado').length;
    const totalAll = allDeals.length;
    if (totalAll === 0) return {} as Record<string, number>;

    const stageWeights: Record<string, number> = {
      prospeccao: 0.1, qualificacao: 0.3, proposta: 0.5, negociacao: 0.75, fechado: 1.0, perdido: 0,
    };

    if (totalClosed > 0) {
      const baseRate = totalClosed / totalAll;
      const result: Record<string, number> = {};
      for (const stage of STAGES) {
        if (stage.key === 'fechado') result[stage.key] = 100;
        else if (stage.key === 'perdido') result[stage.key] = 0;
        else result[stage.key] = Math.round(Math.min(baseRate * (stageWeights[stage.key] / 0.1) * 100, 95));
      }
      return result;
    }

    const result: Record<string, number> = {};
    for (const stage of STAGES) {
      result[stage.key] = Math.round(stageWeights[stage.key] * 100);
    }
    return result;
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

  const moveDeal = async (dealId: string, stage: string, lossReason?: string) => {
    const deal = deals.find(d => d.id === dealId);
    const oldStage = deal?.stage || '';
    const updateData: any = { stage };
    if (lossReason) updateData.loss_reason = lossReason;
    if (stage === 'fechado') updateData.loss_reason = null;

    await supabase.from('deals').update(updateData).eq('id', dealId);
    queryClient.invalidateQueries({ queryKey: ['deals'] });
    queryClient.invalidateQueries({ queryKey: ['deals-all-for-probability'] });

    if (stage === 'fechado') {
      fireConfetti();
      toast('🎉 Negócio Fechado!', { description: 'Parabéns pela conquista!' });
    }

    // Notify followers about stage change
    const stageLabels: Record<string, string> = {
      prospeccao: 'Prospecção', qualificacao: 'Qualificação', proposta: 'Proposta',
      negociacao: 'Negociação', fechado: 'Fechado', perdido: 'Perdido',
    };
    const myName = profiles.find(p => p.user_id === user?.id)?.full_name || 'Alguém';
    await notifyDealFollowers(
      dealId,
      'deal_stage_changed',
      `Negócio "${deal?.name}" mudou de estágio`,
      `${myName} moveu de ${stageLabels[oldStage] || oldStage} → ${stageLabels[stage] || stage}`,
      user?.id
    );
  };

  const handleDrop = async (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('dealId');
    const deal = deals.find(d => d.id === dealId);

    if (stage === 'perdido') {
      setLossModal({ dealId, dealName: deal?.name || '' });
      return;
    }

    await moveDeal(dealId, stage);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const formatCurrency = (val: number | null) =>
    val != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : '-';

  const getHealthColor = (updatedAt: string) => {
    const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
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
          const probability = stageProbability[stage.key];

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
                {probability !== undefined && stage.key !== 'perdido' && (
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] font-medium text-muted-foreground">{probability}% probabilidade</span>
                  </div>
                )}
              </div>
              <div className="space-y-2 min-h-[200px] bg-muted/30 rounded-b-xl p-2">
                {stageDeals.map((deal) => (
                  <Card
                    key={deal.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, deal.id)}
                    onClick={() => setSelectedDeal(deal)}
                    className="cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-200 border-border"
                  >
                    <CardContent className="p-3 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-sm text-card-foreground leading-tight">{deal.name}</p>
                        <span
                          className={`flex-shrink-0 mt-1 h-2.5 w-2.5 rounded-full ${getHealthColor(deal.updated_at)}`}
                          title={`Última atualização: ${new Date(deal.updated_at).toLocaleDateString('pt-BR')}`}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{deal.companies?.name || '-'}</span>
                      </div>
                      {deal.loss_reason && stage.key === 'perdido' && (
                        <Badge variant="destructive" className="text-[10px]">
                          {deal.loss_reason}
                        </Badge>
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
                ))}
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
            await moveDeal(lossModal.dealId, 'perdido', reason);
            setLossModal(null);
          }
        }}
      />

      <DealDetailModal
        deal={selectedDeal ? { ...selectedDeal, company_name: selectedDeal.companies?.name } : null}
        open={!!selectedDeal}
        onOpenChange={(o) => { if (!o) setSelectedDeal(null); }}
      />
    </>
  );
}
