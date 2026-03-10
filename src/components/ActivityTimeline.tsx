import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Briefcase, ListTodo, StickyNote, PhoneCall, CalendarClock, Activity, RefreshCw,
} from 'lucide-react';

const typeConfig: Record<string, { icon: typeof Activity; label: string; color: string }> = {
  deal_created: { icon: Briefcase, label: 'Negócio', color: 'bg-success/10 text-success' },
  task_created: { icon: ListTodo, label: 'Tarefa', color: 'bg-warning/10 text-warning' },
  note_created: { icon: StickyNote, label: 'Nota', color: 'bg-accent/10 text-accent' },
  meeting: { icon: CalendarClock, label: 'Reunião', color: 'bg-primary/10 text-primary' },
  call: { icon: PhoneCall, label: 'Chamada', color: 'bg-primary/10 text-primary' },
  note: { icon: StickyNote, label: 'Nota', color: 'bg-muted text-muted-foreground' },
  property_changed: { icon: RefreshCw, label: 'Alteração', color: 'bg-secondary text-secondary-foreground' },
};

interface ActivityEntry {
  id: string;
  type: string;
  title: string;
  description: string | null;
  activity_date: string;
  created_by: string;
}

interface Props {
  activities: ActivityEntry[];
  profiles?: Record<string, string>;
}

export function ActivityTimeline({ activities, profiles = {} }: Props) {
  if (activities.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8 text-xs">
        Nenhuma atividade registrada. Crie negócios, tarefas ou notas para gerar o histórico automaticamente.
      </p>
    );
  }

  return (
    <ScrollArea className="max-h-[520px]">
      <div className="space-y-1">
        {activities.map((a, idx) => {
          const cfg = typeConfig[a.type] || typeConfig.note;
          const Icon = cfg.icon;
          const isLast = idx === activities.length - 1;
          const userName = profiles[a.created_by] || '';

          return (
            <div key={a.id} className="flex gap-3 group">
              {/* Vertical line + icon */}
              <div className="flex flex-col items-center pt-0.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cfg.color} transition-all duration-200 group-hover:scale-110`}>
                  <Icon className="h-4 w-4" />
                </div>
                {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
              </div>

              {/* Content card */}
              <div className="flex-1 pb-4">
                <Card className="border-border shadow-sm hover:shadow-md transition-shadow duration-200">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-foreground leading-snug">
                          {userName && (
                            <span className="text-primary font-semibold">{userName} </span>
                          )}
                          {a.title}
                        </p>
                        {a.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className={`text-[10px] shrink-0 ${cfg.color}`}>
                        {cfg.label}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {new Date(a.activity_date).toLocaleString('pt-BR')}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
