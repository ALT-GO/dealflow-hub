import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Bell, Save } from 'lucide-react';

export function AlertsTab() {
  const queryClient = useQueryClient();
  const [idleDays, setIdleDays] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const { data: currentSetting } = useQuery({
    queryKey: ['system-settings', 'idle_alert_days'],
    queryFn: async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'idle_alert_days')
        .maybeSingle();
      if (data?.value) setIdleDays(data.value);
      return data?.value || '180';
    },
  });

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('system_settings')
      .upsert({ key: 'idle_alert_days', value: idleDays || '180' }, { onConflict: 'key' });
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Configuração salva!');
    queryClient.invalidateQueries({ queryKey: ['system-settings'] });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Alerta de Inatividade</CardTitle>
          </div>
          <CardDescription>
            Defina o período de inatividade (em dias) para que o sistema notifique automaticamente o responsável por um negócio sem atividades ou tarefas recentes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3 max-w-xs">
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="idle_days">Dias de Inatividade</Label>
              <Input
                id="idle_days"
                type="number"
                min={1}
                max={365}
                value={idleDays}
                onChange={e => setIdleDays(e.target.value)}
                placeholder="180"
              />
            </div>
            <Button onClick={handleSave} disabled={saving} size="sm">
              <Save className="h-4 w-4 mr-1" />{saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Exemplo: 180 dias = 6 meses. Negócios sem nenhuma atividade ou tarefa nesse período gerarão uma notificação automática.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
