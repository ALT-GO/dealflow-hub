import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SmartDatePicker } from '@/components/SmartDatePicker';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBudgetTeamMembers } from '@/hooks/useBudgetTeamMembers';
import { toast } from 'sonner';
import { Building2, DollarSign, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import { useEstimatorWorkload } from '@/components/EstimatorGantt';

interface Deal {
  id: string;
  name: string;
  value: number | null;
  stage: string;
  company_id: string;
  owner_id: string;
  target_delivery_date?: string | null;
  business_area?: string | null;
  scope?: string | null;
  approval_status?: string;
  orcamentista_id?: string | null;
}

interface Props {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BUSINESS_AREA_LABELS: Record<string, string> = {
  infraestrutura_predial: 'Infraestrutura Predial', missao_critica: 'Missão Crítica',
  seguranca_eletronica: 'Segurança Eletrônica', inteligencia_predial: 'Inteligência Predial',
  energia: 'Energia', outro: 'Outro',
};

const formatCurrency = (val: number | null) =>
  val != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : '-';

export function ApprovalModal({ deal, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [selectedOrcamentista, setSelectedOrcamentista] = useState('');
  const { data: workloadMap = {} } = useEstimatorWorkload();

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-list'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
    enabled: open,
  });

  const { data: companyName } = useQuery({
    queryKey: ['company-name', deal?.company_id],
    queryFn: async () => {
      if (!deal?.company_id) return null;
      const { data } = await supabase.from('companies').select('name').eq('id', deal.company_id).single();
      return data?.name || null;
    },
    enabled: !!deal?.company_id && open,
  });

  if (!deal) return null;

  const handleApprove = async () => {
    if (!user) return;
    setLoading(true);
    const updateData: any = { approval_status: 'approved' };
    if (selectedOrcamentista) updateData.orcamentista_id = selectedOrcamentista;
    const { error } = await supabase.from('deals').update(updateData).eq('id', deal.id);
    if (error) { toast.error('Erro ao aprovar'); setLoading(false); return; }

    await supabase.from('notifications').insert({
      user_id: deal.owner_id,
      type: 'approval_result',
      title: `Negócio "${deal.name}" aprovado`,
      description: 'Sua solicitação de orçamento foi aprovada pela gerência.',
      entity_type: 'deal',
      entity_id: deal.id,
    } as any);

    if (selectedOrcamentista) {
      await supabase.from('deal_followers').insert({ deal_id: deal.id, user_id: selectedOrcamentista } as any);
    }

    setLoading(false);
    toast.success('Negócio aprovado!');
    queryClient.invalidateQueries({ queryKey: ['deals'] });
    queryClient.invalidateQueries({ queryKey: ['deal', deal.id] });
    onOpenChange(false);
  };

  const handleReject = async () => {
    if (!user || !newDate) { toast.error('Selecione uma nova data'); return; }
    setLoading(true);
    const { error } = await supabase.from('deals').update({
      approval_status: 'rejected',
      target_delivery_date: newDate,
    } as any).eq('id', deal.id);
    if (error) { toast.error('Erro ao reprovar'); setLoading(false); return; }

    await supabase.from('notifications').insert({
      user_id: deal.owner_id,
      type: 'approval_result',
      title: `Data alterada: "${deal.name}"`,
      description: `A gerência propôs nova data de entrega: ${new Date(newDate).toLocaleDateString('pt-BR')}.`,
      entity_type: 'deal',
      entity_id: deal.id,
    } as any);

    setLoading(false);
    toast.success('Data alterada e solicitante notificado.');
    queryClient.invalidateQueries({ queryKey: ['deals'] });
    queryClient.invalidateQueries({ queryKey: ['deal', deal.id] });
    onOpenChange(false);
    setRejectMode(false);
    setNewDate('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Aprovação de Solicitação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <p className="font-semibold text-foreground">{deal.name}</p>
            {companyName && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" />{companyName}
              </p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold text-primary flex items-center gap-0.5">
                <DollarSign className="h-3 w-3" />{formatCurrency(deal.value)}
              </span>
              {deal.business_area && (
                <Badge variant="secondary" className="text-[10px]">{BUSINESS_AREA_LABELS[deal.business_area] || deal.business_area}</Badge>
              )}
            </div>
            {deal.target_delivery_date && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />Data Solicitada: <span className="font-semibold text-foreground">{new Date(deal.target_delivery_date).toLocaleDateString('pt-BR')}</span>
              </p>
            )}
            {deal.scope && (
              <div>
                <p className="text-xs text-muted-foreground">Escopo:</p>
                <p className="text-sm text-foreground">{deal.scope}</p>
              </div>
            )}
          </div>

          {!rejectMode ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Atribuir Orçamentista</Label>
                <Select value={selectedOrcamentista} onValueChange={setSelectedOrcamentista}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {profiles.map(p => {
                      const count = workloadMap[p.user_id] || 0;
                      return (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          <span className="flex items-center gap-2">
                            <span>{p.full_name || p.user_id}</span>
                            {count > 0 && <span className="text-[10px] text-muted-foreground">({count} {count === 1 ? 'projeto' : 'projetos'})</span>}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Smart date picker: Approve with date awareness */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Aprovar Data de Entrega</Label>
                <SmartDatePicker
                  value={deal.target_delivery_date || ''}
                  onChange={() => {}}
                  placeholder="Data solicitada"
                  disabled
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Proponha uma nova data de entrega realista:</p>
              <SmartDatePicker
                value={newDate}
                onChange={setNewDate}
                placeholder="Nova data de entrega"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          {!rejectMode ? (
            <>
              <Button variant="outline" className="text-destructive border-destructive/30" onClick={() => setRejectMode(true)}>
                <XCircle className="h-4 w-4 mr-1" />Reprovar/Alterar Data
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleApprove} disabled={loading}>
                <CheckCircle2 className="h-4 w-4 mr-1" />{loading ? 'Aprovando...' : 'Aprovar Data'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setRejectMode(false)}>Voltar</Button>
              <Button variant="destructive" onClick={handleReject} disabled={loading || !newDate}>
                {loading ? 'Enviando...' : 'Confirmar Nova Data'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
