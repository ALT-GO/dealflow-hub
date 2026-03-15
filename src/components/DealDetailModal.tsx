import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DealFollowers } from '@/components/DealFollowers';
import { CommentBox } from '@/components/CommentBox';
import { TasksChecklist } from '@/components/TasksChecklist';
import { FileManager } from '@/components/FileManager';
import { Badge } from '@/components/ui/badge';
import { Building2, DollarSign, Calendar, Eye, MessageCircle, ListTodo, Paperclip, MapPin } from 'lucide-react';

interface Deal {
  id: string;
  name: string;
  value: number | null;
  stage: string;
  close_date: string | null;
  company_name?: string;
  origin_id?: string | null;
}

interface Props {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const stageLabels: Record<string, string> = {
  prospeccao: 'Prospecção', qualificacao: 'Qualificação', proposta: 'Proposta',
  negociacao: 'Negociação', fechado: 'Fechado', perdido: 'Perdido',
};

const formatCurrency = (val: number | null) =>
  val != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : '-';

export function DealDetailModal({ deal, open, onOpenChange }: Props) {
  const { data: dealOrigins = [] } = useQuery({
    queryKey: ['deal-origins'],
    queryFn: async () => {
      const { data } = await supabase.from('deal_origins').select('*');
      return data || [];
    },
  });

  if (!deal) return null;

  const originLabel = deal.origin_id ? dealOrigins.find((o: any) => o.id === deal.origin_id)?.label : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{deal.name}</DialogTitle>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {deal.company_name && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" />{deal.company_name}
              </span>
            )}
            <Badge variant="secondary" className="text-[10px]">{stageLabels[deal.stage] || deal.stage}</Badge>
            <span className="text-xs font-semibold text-primary flex items-center gap-0.5">
              <DollarSign className="h-3 w-3" />{formatCurrency(deal.value)}
            </span>
            {originLabel && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />{originLabel}
              </span>
            )}
            {deal.close_date && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Calendar className="h-3 w-3" />{new Date(deal.close_date).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Eye className="h-3.5 w-3.5" />Seguidores
            </p>
            <DealFollowers dealId={deal.id} />
          </div>

          <Tabs defaultValue="comments">
            <TabsList>
              <TabsTrigger value="comments" className="text-xs gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" />Comentários
              </TabsTrigger>
              <TabsTrigger value="tasks" className="text-xs gap-1.5">
                <ListTodo className="h-3.5 w-3.5" />Tarefas
              </TabsTrigger>
              <TabsTrigger value="files" className="text-xs gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />Arquivos
              </TabsTrigger>
            </TabsList>
            <TabsContent value="comments" className="mt-3">
              <CommentBox entityType="deal" entityId={deal.id} />
            </TabsContent>
            <TabsContent value="tasks" className="mt-3">
              <TasksChecklist dealId={deal.id} />
            </TabsContent>
            <TabsContent value="files" className="mt-3">
              <FileManager entityType="deal" entityId={deal.id} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
