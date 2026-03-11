import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Shield } from 'lucide-react';

const ROLES = ['admin', 'vendedor'] as const;

export function PermissionsTab() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['page-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('page_permissions')
        .select('*')
        .order('page_path');
      if (error) throw error;
      return data as { id: string; page_path: string; page_label: string; allowed_roles: string[] }[];
    },
  });

  const handleToggle = async (permId: string, roleName: string, currentlyAllowed: boolean) => {
    const perm = permissions.find(p => p.id === permId);
    if (!perm) return;

    setSaving(permId + roleName);
    let newRoles: string[];
    if (currentlyAllowed) {
      newRoles = perm.allowed_roles.filter(r => r !== roleName);
    } else {
      newRoles = [...perm.allowed_roles, roleName];
    }

    const { error } = await supabase.from('page_permissions').update({ allowed_roles: newRoles }).eq('id', permId);
    setSaving(null);
    if (error) { toast.error('Erro ao atualizar permissão'); return; }
    toast.success('Permissão atualizada!');
    queryClient.invalidateQueries({ queryKey: ['page-permissions'] });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (role !== 'admin') {
    return <p className="text-sm text-muted-foreground mt-4">Apenas administradores podem gerenciar permissões.</p>;
  }

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">Defina quais roles podem acessar cada página do sistema.</p>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {/* Header */}
            <div className="flex items-center gap-4 px-5 py-3 bg-muted/50">
              <span className="text-xs font-semibold text-muted-foreground flex-1">Página</span>
              {ROLES.map(r => (
                <span key={r} className="text-xs font-semibold text-muted-foreground w-24 text-center capitalize">{r}</span>
              ))}
            </div>
            {permissions.map((perm) => (
              <div key={perm.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{perm.page_label}</p>
                  <code className="text-[10px] text-muted-foreground font-mono">{perm.page_path}</code>
                </div>
                {ROLES.map(r => {
                  const allowed = perm.allowed_roles.includes(r);
                  const isSaving = saving === perm.id + r;
                  return (
                    <div key={r} className="w-24 flex justify-center">
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Switch
                          checked={allowed}
                          onCheckedChange={() => handleToggle(perm.id, r, allowed)}
                          disabled={r === 'admin'} // admin always has access
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {permissions.length === 0 && (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">
                Nenhuma restrição de página configurada. Todas as páginas são acessíveis por todos os roles.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        <Shield className="h-3 w-3 inline mr-1" />
        Admins sempre têm acesso total. Use os switches para controlar o acesso dos vendedores.
      </p>
    </div>
  );
}
