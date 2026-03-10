import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { UsersRound, Shield, Briefcase, DollarSign, Target } from 'lucide-react';

type TeamMember = {
  user_id: string;
  role: string;
  profile: { full_name: string | null } | null;
  deal_count: number;
  deal_value: number;
};

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function TeamManagement() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const now = new Date();
  const [goalForm, setGoalForm] = useState({
    user_id: '',
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
    target_value: '',
    target_deals_count: '',
  });

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
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

  // Fetch current month goals
  const { data: goals = [] } = useQuery({
    queryKey: ['sales-goals', now.getMonth() + 1, now.getFullYear()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_goals')
        .select('*')
        .eq('month', now.getMonth() + 1)
        .eq('year', now.getFullYear());
      if (error) throw error;
      return data;
    },
  });

  const handleSetGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setGoalSaving(true);

    // Upsert: delete existing then insert
    await supabase
      .from('sales_goals')
      .delete()
      .eq('user_id', goalForm.user_id)
      .eq('month', Number(goalForm.month))
      .eq('year', Number(goalForm.year));

    const { error } = await supabase.from('sales_goals').insert({
      user_id: goalForm.user_id,
      month: Number(goalForm.month),
      year: Number(goalForm.year),
      target_value: Number(goalForm.target_value) || 0,
      target_deals_count: Number(goalForm.target_deals_count) || 0,
    });

    setGoalSaving(false);
    if (error) {
      toast.error('Erro ao definir meta: ' + error.message);
    } else {
      toast.success('Meta definida!');
      setGoalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['sales-goals'] });
    }
  };

  const admins = members.filter((m) => m.role === 'admin');
  const sellers = members.filter((m) => m.role === 'vendedor');
  const totalPipeline = members.reduce((sum, m) => sum + m.deal_value, 0);
  const totalDeals = members.reduce((sum, m) => sum + m.deal_count, 0);

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  };

  const getUserGoal = (userId: string) => goals.find((g: any) => g.user_id === userId);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <UsersRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Gestão de Equipe</h1>
            <p className="text-sm text-muted-foreground">{members.length} membros · {admins.length} admin(s) · {sellers.length} vendedor(es)</p>
          </div>
        </div>
        {role === 'admin' && (
          <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
            <DialogTrigger asChild>
              <Button><Target className="h-4 w-4 mr-2" />Definir Meta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Definir Meta Mensal</DialogTitle></DialogHeader>
              <form onSubmit={handleSetGoal} className="space-y-4">
                <div className="space-y-2">
                  <Label>Vendedor</Label>
                  <Select value={goalForm.user_id} onValueChange={(v) => setGoalForm({ ...goalForm, user_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar vendedor" /></SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.profile?.full_name || m.user_id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Mês</Label>
                    <Select value={goalForm.month} onValueChange={(v) => setGoalForm({ ...goalForm, month: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m, i) => (
                          <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ano</Label>
                    <Input type="number" value={goalForm.year} onChange={(e) => setGoalForm({ ...goalForm, year: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Meta de Valor (R$)</Label>
                  <Input type="number" step="0.01" placeholder="50000" value={goalForm.target_value} onChange={(e) => setGoalForm({ ...goalForm, target_value: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Meta de Negócios (qtd)</Label>
                  <Input type="number" placeholder="10" value={goalForm.target_deals_count} onChange={(e) => setGoalForm({ ...goalForm, target_deals_count: e.target.value })} />
                </div>
                <Button type="submit" className="w-full" disabled={goalSaving || !goalForm.user_id}>
                  {goalSaving ? 'Salvando...' : 'Salvar Meta'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
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

      {/* Members table with goals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Membros da Equipe — {MONTHS[now.getMonth()]} {now.getFullYear()}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead className="text-right">Negócios</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-right">Meta (R$)</TableHead>
                <TableHead className="text-right">Progresso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const goal = getUserGoal(m.user_id);
                const targetValue = goal ? Number((goal as any).target_value) : 0;
                const progress = targetValue > 0 ? Math.min((m.deal_value / targetValue) * 100, 100) : 0;
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
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {targetValue > 0 ? formatCurrency(targetValue) : (
                        <span className="text-xs text-muted-foreground/50">Sem meta</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {targetValue > 0 ? (
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-primary' : 'bg-yellow-500'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-10 text-right">{progress.toFixed(0)}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum membro encontrado</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
