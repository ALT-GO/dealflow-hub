import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLossReasons } from '@/hooks/useLossReasons';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  open: boolean;
  onConfirm: (reason: string, notes?: string) => void;
  onCancel: () => void;
  dealName?: string;
};

export function LossReasonModal({ open, onConfirm, onCancel, dealName }: Props) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const { data: lossReasons = [] } = useLossReasons();

  const handleConfirm = () => {
    if (!reason) return;
    onConfirm(reason, notes || undefined);
    setReason('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Motivo da Perda</DialogTitle>
          {dealName && <p className="text-sm text-muted-foreground mt-1">Negócio: {dealName}</p>}
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Por que este negócio foi perdido?</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {lossReasons.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalhes adicionais..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!reason}>Confirmar Perda</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
