import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell, AtSign, Briefcase, ListTodo, Check, CheckCheck, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { ApprovalModal } from '@/components/ApprovalModal';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

const typeIcons: Record<string, typeof AtSign> = {
  mention: AtSign,
  deal_assigned: Briefcase,
  deal_stage_changed: Briefcase,
  deal_comment: Briefcase,
  task_due: ListTodo,
  approval_request: ShieldCheck,
  approval_result: ShieldCheck,
};

const typeColors: Record<string, string> = {
  mention: 'bg-primary/10 text-primary',
  deal_assigned: 'bg-success/10 text-success',
  deal_stage_changed: 'bg-blue-500/10 text-blue-600',
  deal_comment: 'bg-indigo-500/10 text-indigo-600',
  task_due: 'bg-warning/10 text-warning',
  approval_request: 'bg-amber-500/10 text-amber-600',
  approval_result: 'bg-emerald-500/10 text-emerald-600',
};

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [approvalDeal, setApprovalDeal] = useState<any>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as Notification;
          toast(n.title, { description: n.description || undefined });
          queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true } as any).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true } as any).eq('user_id', user.id).eq('is_read', false);
    queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
  };

  const handleClick = async (n: Notification) => {
    markAsRead(n.id);
    setOpen(false);

    // Open approval modal for approval_request notifications
    if (n.type === 'approval_request' && n.entity_type === 'deal' && n.entity_id) {
      const { data: dealData } = await supabase.from('deals').select('*').eq('id', n.entity_id).single();
      if (dealData) {
        setApprovalDeal(dealData);
        setApprovalOpen(true);
        return;
      }
    }

    if (n.entity_type && n.entity_id) {
      const routes: Record<string, string> = {
        company: `/companies/${n.entity_id}`,
        contact: `/contacts/${n.entity_id}`,
        deal: `/deals/${n.entity_id}`,
        task: `/dashboard`,
      };
      navigate(routes[n.entity_type] || '/dashboard');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] bg-destructive text-destructive-foreground border-2 border-card">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 text-primary" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[360px]">
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-xs">Nenhuma notificação</p>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map(n => {
                const Icon = typeIcons[n.type] || Bell;
                const color = typeColors[n.type] || 'bg-muted text-muted-foreground';

                return (
                  <button
                    key={n.id}
                    className={`w-full flex items-start gap-3 p-3 text-left hover:bg-muted/50 transition-colors ${!n.is_read ? 'bg-primary/5' : ''}`}
                    onClick={() => handleClick(n)}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold text-foreground' : 'text-foreground'}`}>
                        {n.title}
                      </p>
                      {n.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.description}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
      <ApprovalModal deal={approvalDeal} open={approvalOpen} onOpenChange={setApprovalOpen} />
    </Popover>
  );
}
