import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Percent } from 'lucide-react';

type Props = {
  open: boolean;
  dealName?: string;
  dealValue?: number;
  onCancel: () => void;
  onConfirm: (margin: number) => void;
};

export function ProfitMarginModal({ open, dealName, dealValue, onCancel, onConfirm }: Props) {
  const [margin, setMargin] = useState('');
  const [saving, setSaving] = useState(false);

  const marginNum = parseFloat(margin) || 0;
  const profitAmount = (dealValue || 0) * (marginNum / 100);

  const handleConfirm = async () => {
    if (marginNum <= 0 || marginNum > 100) return;
    setSaving(true);
    await onConfirm(marginNum);
    setSaving(false);
    setMargin('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Percentual de Lucro Obrigatório</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Para marcar o negócio "{dealName}" como ganho, informe o percentual de lucro.
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Percentual de Lucro (%)</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.1"
                min="0.1"
                max="100"
                value={margin}
                onChange={(e) => setMargin(e.target.value)}
                placeholder="Ex: 15"
                className="pr-8"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          {marginNum > 0 && dealValue && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="text-muted-foreground">Lucro estimado:</p>
              <p className="text-lg font-bold text-primary">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(profitAmount)}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving || marginNum <= 0 || marginNum > 100}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Confirmar e Fechar Negócio'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
