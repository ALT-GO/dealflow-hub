import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LOSS_REASONS } from '@/components/LossReasonModal';

export function LossReasonsTab() {
  return (
    <div className="space-y-4 mt-4">
      <div>
        <p className="text-sm text-muted-foreground">Motivos disponíveis ao marcar um negócio como perdido.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {LOSS_REASONS.map((reason) => (
              <div key={reason.value} className="flex items-center gap-4 px-5 py-3">
                <Badge variant="outline" className="text-xs border-destructive/30 text-destructive bg-destructive/5">
                  {reason.label}
                </Badge>
                <code className="text-xs text-muted-foreground font-mono ml-auto">{reason.value}</code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Os motivos de perda são fixos no momento. Em breve será possível criar motivos customizados.
      </p>
    </div>
  );
}
