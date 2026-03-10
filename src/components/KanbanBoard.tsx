import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, DollarSign, Calendar } from 'lucide-react';

const STAGES = [
  { key: 'prospeccao', label: 'Prospecção', color: 'bg-muted' },
  { key: 'qualificacao', label: 'Qualificação', color: 'bg-secondary' },
  { key: 'proposta', label: 'Proposta', color: 'bg-accent/10' },
  { key: 'negociacao', label: 'Negociação', color: 'bg-warning/10' },
  { key: 'fechado', label: 'Fechado', color: 'bg-success/10' },
];

type Deal = {
  id: string;
  name: string;
  value: number | null;
  stage: string;
  close_date: string | null;
  updated_at: string;
  company_id: string;
  companies: { name: string } | null;
};

export function KanbanBoard() {
  const queryClient = useQueryClient();
  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('id, name, value, stage, close_date, updated_at, company_id, companies(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Deal[];
    },
  });

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData('dealId', dealId);
  };

  const handleDrop = async (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('dealId');
    await supabase.from('deals').update({ stage }).eq('id', dealId);
    queryClient.invalidateQueries({ queryKey: ['deals'] });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const formatCurrency = (val: number | null) =>
    val != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : '-';

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;
  }

  return (
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
            <div className={`rounded-t-lg px-4 py-3 ${stage.color}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-foreground">{stage.label}</h3>
                <Badge variant="secondary" className="text-xs">
                  {stageDeals.length}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(total)}</p>
            </div>
            <div className="space-y-2 min-h-[200px] bg-muted/30 rounded-b-lg p-2">
              {stageDeals.map((deal) => (
                <Card
                  key={deal.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, deal.id)}
                  className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border-border"
                >
                  <CardContent className="p-3 space-y-2">
                    <p className="font-medium text-sm text-card-foreground">{deal.name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      <span>{deal.companies?.name || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
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
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
