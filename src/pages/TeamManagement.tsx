import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UsersRound, Shield, Briefcase, DollarSign } from 'lucide-react';

type TeamMember = {
  user_id: string;
  role: string;
  profile: { full_name: string | null } | null;
  deal_count: number;
  deal_value: number;
};

export default function TeamManagement() {
  const { role } = useAuth();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      // Get all user_roles with profiles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (rolesError) throw rolesError;

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name');
      if (profilesError) throw profilesError;

      const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select('owner_id, value');
      if (dealsError) throw dealsError;

      // Aggregate
      const memberMap = new Map<string, TeamMember>();
      for (const r of roles) {
        const profile = profiles.find((p) => p.user_id === r.user_id);
        const userDeals = deals.filter((d) => d.owner_id === r.user_id);
        memberMap.set(r.user_id, {
          user_id: r.user_id,
          role: r.role,
          profile: profile ? { full_name: profile.full_name } : null,
          deal_count: userDeals.length,
          deal_value: userDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0),
        });
      }
      return Array.from(memberMap.values()).sort((a, b) => b.deal_value - a.deal_value);
    },
  });

  const admins = members.filter((m) => m.role === 'admin');
  const sellers = members.filter((m) => m.role === 'vendedor');
  const totalPipeline = members.reduce((sum, m) => sum + m.deal_value, 0);
  const totalDeals = members.reduce((sum, m) => sum + m.deal_count, 0);

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <UsersRound className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Gestão de Equipe</h1>
          <p className="text-sm text-muted-foreground">{members.length} membros · {admins.length} admin(s) · {sellers.length} vendedor(es)</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <UsersRound className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Membros</p>
                <p className="text-2xl font-display font-bold text-foreground">{members.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Negócios</p>
                <p className="text-2xl font-display font-bold text-foreground">{totalDeals}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pipeline Total</p>
                <p className="text-2xl font-display font-bold text-foreground">{formatCurrency(totalPipeline)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Membros da Equipe</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead className="text-right">Negócios</TableHead>
                <TableHead className="text-right">Volume (Pipeline)</TableHead>
                <TableHead className="text-right">% do Pipeline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const pct = totalPipeline > 0 ? ((m.deal_value / totalPipeline) * 100).toFixed(1) : '0';
                return (
                  <TableRow key={m.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                            {getInitials(m.profile?.full_name || null)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm text-foreground">{m.profile?.full_name || 'Sem nome'}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{m.user_id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={m.role === 'admin'
                          ? 'bg-primary/10 text-primary text-xs'
                          : 'bg-accent/10 text-accent text-xs'
                        }
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        {m.role === 'admin' ? 'Admin' : 'Vendedor'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground">{m.deal_count}</TableCell>
                    <TableCell className="text-right font-medium text-foreground">{formatCurrency(m.deal_value)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum membro encontrado</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
