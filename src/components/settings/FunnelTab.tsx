import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { GripVertical, Plus, Trash2 } from 'lucide-react';

// For now stages are hardcoded; this tab allows viewing and future customization
const DEFAULT_STAGES = [
  { key: 'prospeccao', label: 'Prospecção', color: 'bg-muted text-muted-foreground' },
  { key: 'qualificacao', label: 'Qualificação', color: 'bg-secondary text-secondary-foreground' },
  { key: 'proposta', label: 'Proposta', color: 'bg-accent/20 text-accent-foreground' },
  { key: 'negociacao', label: 'Negociação', color: 'bg-warning/20 text-warning' },
  { key: 'fechado', label: 'Fechado', color: 'bg-success/20 text-success' },
  { key: 'perdido', label: 'Perdido', color: 'bg-destructive/20 text-destructive' },
];

export function FunnelTab() {
  const { role } = useAuth();

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Estágios do funil de vendas utilizados no pipeline de negócios.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {DEFAULT_STAGES.map((stage, index) => (
              <div key={stage.key} className="flex items-center gap-4 px-5 py-3">
                <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                <span className="text-sm font-medium text-foreground w-8">{index + 1}.</span>
                <Badge className={`${stage.color} border-0 text-xs`}>{stage.label}</Badge>
                <code className="text-xs text-muted-foreground font-mono ml-auto">{stage.key}</code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Os estágios do funil são fixos no momento. Em breve será possível criar funis customizados.
      </p>
    </div>
  );
}
