import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Eye, EyeOff, Plus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  dealId: string;
}

export function DealFollowers({ dealId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-all'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
  });

  const { data: followers = [] } = useQuery({
    queryKey: ['deal-followers', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_followers')
        .select('id, user_id')
        .eq('deal_id', dealId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!dealId,
  });

  const isFollowing = followers.some(f => f.user_id === user?.id);

  const toggleFollow = async () => {
    if (!user) return;
    if (isFollowing) {
      const follower = followers.find(f => f.user_id === user.id);
      if (follower) {
        await supabase.from('deal_followers').delete().eq('id', follower.id);
        toast('Você deixou de seguir este negócio');
      }
    } else {
      await supabase.from('deal_followers').insert({ deal_id: dealId, user_id: user.id } as any);
      toast('Você está seguindo este negócio');
    }
    queryClient.invalidateQueries({ queryKey: ['deal-followers', dealId] });
  };

  const addFollower = async (userId: string) => {
    if (followers.some(f => f.user_id === userId)) return;
    await supabase.from('deal_followers').insert({ deal_id: dealId, user_id: userId } as any);
    queryClient.invalidateQueries({ queryKey: ['deal-followers', dealId] });
    toast('Seguidor adicionado');
  };

  const getInitials = (userId: string) => {
    const p = profiles.find(pr => pr.user_id === userId);
    if (!p?.full_name) return '?';
    return p.full_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  };

  const getName = (userId: string) => profiles.find(p => p.user_id === userId)?.full_name || 'Usuário';

  const nonFollowers = profiles.filter(p => !followers.some(f => f.user_id === p.user_id));

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {followers.slice(0, 5).map(f => (
          <Avatar key={f.id} className="h-6 w-6 border-2 border-card" title={getName(f.user_id)}>
            <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
              {getInitials(f.user_id)}
            </AvatarFallback>
          </Avatar>
        ))}
        {followers.length > 5 && (
          <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-semibold text-muted-foreground border-2 border-card">
            +{followers.length - 5}
          </span>
        )}
      </div>

      <Button
        variant={isFollowing ? 'secondary' : 'outline'}
        size="sm"
        className="h-7 text-[10px] gap-1"
        onClick={toggleFollow}
      >
        {isFollowing ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        {isFollowing ? 'Seguindo' : 'Seguir'}
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="end">
          <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Adicionar seguidor</p>
          {nonFollowers.map(p => (
            <button
              key={p.user_id}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted/50 transition-colors text-left"
              onClick={() => addFollower(p.user_id)}
            >
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[8px] bg-primary/10 text-primary font-semibold">
                  {getInitials(p.user_id)}
                </AvatarFallback>
              </Avatar>
              <span className="text-foreground text-xs">{p.full_name}</span>
            </button>
          ))}
          {nonFollowers.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Todos já seguem</p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Utility: notify all followers of a deal
export async function notifyDealFollowers(
  dealId: string,
  type: string,
  title: string,
  description: string,
  excludeUserId?: string,
) {
  const { data: followers } = await supabase
    .from('deal_followers')
    .select('user_id')
    .eq('deal_id', dealId);

  if (!followers?.length) return;

  const notifications = followers
    .filter(f => f.user_id !== excludeUserId)
    .map(f => ({
      user_id: f.user_id,
      type,
      title,
      description,
      entity_type: 'deal',
      entity_id: dealId,
    }));

  if (notifications.length > 0) {
    await supabase.from('notifications').insert(notifications as any);
  }
}
