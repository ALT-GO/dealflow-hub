import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';

interface Profile {
  user_id: string;
  full_name: string | null;
}

interface Comment {
  id: string;
  content: string;
  mentions: string[];
  created_by: string;
  created_at: string;
}

interface Props {
  entityType: 'company' | 'contact' | 'deal';
  entityId: string;
}

export function CommentBox({ entityType, entityId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ['profiles-all'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
  });

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: ['comments', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('id, content, mentions, created_by, created_at')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map((c: any) => ({ ...c, mentions: c.mentions || [] }));
    },
    enabled: !!entityId,
  });

  const filteredProfiles = profiles.filter(p =>
    p.full_name && (!mentionQuery || p.full_name.toLowerCase().includes(mentionQuery.toLowerCase()))
  );

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex >= 0) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Only show if no space before @ (or start of string) and no newline after @
      if ((lastAtIndex === 0 || /\s/.test(val[lastAtIndex - 1])) && !/\s/.test(textAfterAt)) {
        setShowMentions(true);
        setMentionQuery(textAfterAt);
        setMentionStart(lastAtIndex);
        return;
      }
    }
    setShowMentions(false);
  }, []);

  const insertMention = (profile: Profile) => {
    const name = profile.full_name || '';
    const before = content.slice(0, mentionStart);
    const after = content.slice((textareaRef.current?.selectionStart || mentionStart) + mentionQuery.length + 1);
    setContent(`${before}@${name} ${after}`);
    setShowMentions(false);
    setMentionQuery('');
    textareaRef.current?.focus();
  };

  const extractMentionIds = (text: string): string[] => {
    const ids: string[] = [];
    profiles.forEach(p => {
      if (p.full_name && text.includes(`@${p.full_name}`)) {
        ids.push(p.user_id);
      }
    });
    return [...new Set(ids)];
  };

  const handleSubmit = async () => {
    if (!content.trim() || !user) return;
    setSending(true);

    const mentionIds = extractMentionIds(content);

    const { error } = await supabase.from('comments').insert({
      content: content.trim(),
      entity_type: entityType,
      entity_id: entityId,
      mentions: mentionIds,
      created_by: user.id,
    } as any);

    if (error) {
      toast.error('Erro ao enviar comentário');
      setSending(false);
      return;
    }

    // Create notifications for mentioned users
    if (mentionIds.length > 0) {
      const myName = profiles.find(p => p.user_id === user.id)?.full_name || 'Alguém';
      const entityLabel = entityType === 'company' ? 'empresa' : entityType === 'contact' ? 'contato' : 'negócio';

      const notifications = mentionIds
        .filter(id => id !== user.id)
        .map(userId => ({
          user_id: userId,
          type: 'mention',
          title: `${myName} mencionou você`,
          description: content.trim().slice(0, 120),
          entity_type: entityType,
          entity_id: entityId,
        }));

      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications as any);
      }
    }

    setContent('');
    setSending(false);
    queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] });
  };

  const getInitials = (userId: string) => {
    const p = profiles.find(pr => pr.user_id === userId);
    if (!p?.full_name) return '?';
    return p.full_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  };

  const getName = (userId: string) => profiles.find(p => p.user_id === userId)?.full_name || 'Usuário';

  // Render content with highlighted @mentions
  const renderContent = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    let remaining = text;
    let key = 0;

    profiles.forEach(p => {
      if (!p.full_name) return;
      const mention = `@${p.full_name}`;
      while (remaining.includes(mention)) {
        const idx = remaining.indexOf(mention);
        if (idx > 0) parts.push(remaining.slice(0, idx));
        parts.push(
          <span key={key++} className="text-primary font-semibold bg-primary/10 rounded px-0.5">
            {mention}
          </span>
        );
        remaining = remaining.slice(idx + mention.length);
      }
    });
    if (remaining) parts.push(remaining);
    return parts;
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <MessageCircle className="h-3.5 w-3.5" />
        Comentários Internos ({comments.length})
      </h3>

      {/* Comments list */}
      <ScrollArea className="max-h-[360px]">
        <div className="space-y-2">
          {comments.map((c) => {
            const isMe = c.created_by === user?.id;
            return (
              <div key={c.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                    {getInitials(c.created_by)}
                  </AvatarFallback>
                </Avatar>
                <div className={`max-w-[80%] ${isMe ? 'items-end' : ''}`}>
                  <div className={`rounded-2xl px-3 py-2 text-sm ${
                    isMe
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-secondary text-secondary-foreground rounded-tl-sm'
                  }`}>
                    {!isMe && (
                      <p className="text-[10px] font-semibold mb-0.5 opacity-80">{getName(c.created_by)}</p>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{renderContent(c.content)}</p>
                  </div>
                  <p className={`text-[10px] text-muted-foreground mt-0.5 ${isMe ? 'text-right' : ''}`}>
                    {new Date(c.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            );
          })}
          {comments.length === 0 && !isLoading && (
            <p className="text-center text-muted-foreground py-4 text-xs">Nenhum comentário ainda</p>
          )}
        </div>
      </ScrollArea>

      {/* Input with @mention */}
      <div className="relative">
        {showMentions && filteredProfiles.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-auto">
            {filteredProfiles.map(p => (
              <button
                key={p.user_id}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                onMouseDown={(e) => { e.preventDefault(); insertMention(p); }}
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                    {p.full_name?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-foreground">{p.full_name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleInput}
            placeholder="Escreva um comentário... Use @ para mencionar"
            rows={2}
            className="resize-none flex-1 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !showMentions) {
                e.preventDefault();
                handleSubmit();
              }
              if (e.key === 'Escape') setShowMentions(false);
            }}
          />
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={sending || !content.trim()}
            className="shrink-0 self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
