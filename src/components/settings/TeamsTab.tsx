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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Shield, Briefcase, DollarSign, Target, UsersRound, UserPlus, Plus, Trash2, Users } from 'lucide-react';

type TeamMember = {
  user_id: string;
  role: string;
  profile: { full_name: string | null } | null;
  deal_count: number;
  deal_value: number;
  team_name: string | null;
};

type Team = {
  id: string;
  name: string;
  created_at: string;
  member_count: number;
};

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function TeamsTab() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamSaving, setTeamSaving] = useState(false);
  const [assignOpen, setAssignOpen] = useState<string | null>(null);
  const [subTab, setSubTab] = useState('members');
  const now = new Date();
  const [goalForm, setGoalForm] = useState({
    user_id: '',
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
    target_value: '',
    target_deals_count: '',
  });
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'vendedor', team_id: '' });
  const [teamName, setTeamName] = useState('');
  const [selectedTeamForAssign, setSelectedTeamForAssign] = useState('');

  // Fetch members
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase.from('user_roles').select('user_id, role');
      if (rolesError) throw rolesError;
      const { data: profiles, error: profilesError } = await supabase.from('profiles').select('user_id, full_name');
      if (profilesError) throw profilesError;
      const { data: deals, error: dealsError } = await supabase.from('deals').select('owner_id, value');
      if (dealsError) throw dealsError;
      const { data: teamMembers } = await supabase.from('team_members').select('user_id, team_id, teams(name)');

      const memberMap = new Map<string, TeamMember>();
      for (const r of roles) {
        const profile = profiles.find((p) => p.user_id === r.user_id);
        const userDeals = deals.filter((d) => d.owner_id === r.user_id);
        const tm = (teamMembers || []).find((t: any) => t.user_id === r.user_id);
        memberMap.set(r.user_id, {
          user_id: r.user_id,
          role: r.role,
          profile: profile ? { full_name: profile.full_name } : null,
          deal_count: userDeals.length,
          deal_value: userDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0),
          team_name: tm ? (tm as any).teams?.name || null : null,
        });
      }
      return Array.from(memberMap.values()).sort((a, b) => b.deal_value - a.deal_value);
    },
  });

  // Fetch teams
  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data: teamsData, error } = await supabase.from('teams').select('id, name, created_at');
      if (error) throw error;
      const { data: teamMembers } = await supabase.from('team_members').select('team_id');
      return (teamsData || []).map((t) => ({
        ...t,
        member_count: (teamMembers || []).filter((m: any) => m.team_id === t.id).length,
      })) as Team[];
    },
  });

  // Fetch goals
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

  // Fetch invitations
  const { data: invitations = [] } = useQuery({
    queryKey: ['user-invitations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_invitations').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const handleSetGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setGoalSaving(true);
    await supabase.from('sales_goals').delete()
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
    if (error) { toast.error('Erro ao definir meta: ' + error.message); }
    else { toast.success('Meta definida!'); setGoalOpen(false); queryClient.invalidateQueries({ queryKey: ['sales-goals'] }); }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setInviteSaving(true);
    const { error } = await supabase.from('user_invitations').insert({
      email: inviteForm.email.trim().toLowerCase(),
      role: inviteForm.role,
      team_id: inviteForm.team_id || null,
      invited_by: user.id,
    });
    setInviteSaving(false);
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Este e-mail já foi convidado' : 'Erro: ' + error.message);
    } else {
      toast.success('Convite registrado! O usuário poderá se cadastrar com este e-mail.');
      setInviteOpen(false);
      setInviteForm({ email: '', role: 'vendedor', team_id: '' });
      queryClient.invalidateQueries({ queryKey: ['user-invitations'] });
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setTeamSaving(true);
    const { error } = await supabase.from('teams').insert({ name: teamName.trim(), created_by: user.id });
    setTeamSaving(false);
    if (error) { toast.error('Erro: ' + error.message); }
    else { toast.success('Equipe criada!'); setTeamOpen(false); setTeamName(''); queryClient.invalidateQueries({ queryKey: ['teams'] }); }
  };

  const handleDeleteTeam = async (teamId: string) => {
    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    if (error) toast.error('Erro ao excluir');
    else { toast.success('Equipe excluída'); queryClient.invalidateQueries({ queryKey: ['teams'] }); }
  };

  const handleAssignToTeam = async (userId: string) => {
    if (!selectedTeamForAssign) return;
    // Remove from existing teams first
    await supabase.from('team_members').delete().eq('user_id', userId);
    const { error } = await supabase.from('team_members').insert({ team_id: selectedTeamForAssign, user_id: userId });
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Membro atribuído à equipe!'); setAssignOpen(null); queryClient.invalidateQueries({ queryKey: ['team-members'] }); }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    const { error } = await supabase.from('user_roles').update({ role: newRole as any }).eq('user_id', userId);
    if (error) toast.error('Erro ao alterar papel');
    else { toast.success('Papel atualizado!'); queryClient.invalidateQueries({ queryKey: ['team-members'] }); }
  };

  const admins = members.filter((m) => m.role === 'admin');
  const managers = members.filter((m) => m.role === 'gerencia');
  const budgeters = members.filter((m) => m.role === 'orcamentista');
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
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">{members.length} membros · {admins.length} admin(s) · {managers.length} gerência · {budgeters.length} orçamentista(s) · {sellers.length} vendedor(es)</p>
        {role === 'admin' && (
          <div className="flex items-center gap-2">
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><UserPlus className="h-4 w-4 mr-2" />Convidar</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Convidar Novo Usuário</DialogTitle></DialogHeader>
                <form onSubmit={handleInvite} className="space-y-4">
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="usuario@empresa.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Papel</Label>
                    <Select value={inviteForm.role} onValueChange={(v) => setInviteForm({ ...inviteForm, role: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                                <SelectItem value="vendedor">Vendedor</SelectItem>
                                <SelectItem value="orcamentista">Orçamentista</SelectItem>
                                <SelectItem value="gerencia">Gerência</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {teams.length > 0 && (
                    <div className="space-y-2">
                      <Label>Equipe (opcional)</Label>
                      <Select value={inviteForm.team_id} onValueChange={(v) => setInviteForm({ ...inviteForm, team_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Sem equipe" /></SelectTrigger>
                        <SelectContent>
                          {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={inviteSaving}>
                    {inviteSaving ? 'Enviando...' : 'Registrar Convite'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Target className="h-4 w-4 mr-2" />Definir Meta</Button>
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
                          {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
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
          </div>
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

      {/* Sub-tabs: Members / Teams / Invitations */}
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          <TabsTrigger value="members">Membros</TabsTrigger>
          <TabsTrigger value="teams">Equipes</TabsTrigger>
          <TabsTrigger value="invitations">Convites</TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members">
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
                    <TableHead>Equipe</TableHead>
                    <TableHead className="text-right">Negócios</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">Meta (R$)</TableHead>
                    <TableHead className="text-right">Progresso</TableHead>
                    {role === 'admin' && <TableHead className="w-20">Ações</TableHead>}
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
                          {role === 'admin' && m.user_id !== user?.id ? (
                            <Select value={m.role} onValueChange={(v) => handleChangeRole(m.user_id, v)}>
                              <SelectTrigger className="h-7 w-28 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="gerencia">Gerência</SelectItem>
                                <SelectItem value="orcamentista">Orçamentista</SelectItem>
                                <SelectItem value="vendedor">Vendedor</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="secondary" className={m.role === 'admin' ? 'bg-primary/10 text-primary text-xs' : 'bg-accent/10 text-accent text-xs'}>
                              <Shield className="h-3 w-3 mr-1" />
                              {m.role === 'admin' ? 'Admin' : m.role === 'gerencia' ? 'Gerência' : m.role === 'orcamentista' ? 'Orçamentista' : 'Vendedor'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {m.team_name ? (
                            <Badge variant="outline" className="text-xs">{m.team_name}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium text-foreground">{m.deal_count}</TableCell>
                        <TableCell className="text-right font-medium text-foreground">{formatCurrency(m.deal_value)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {targetValue > 0 ? formatCurrency(targetValue) : <span className="text-xs text-muted-foreground/50">Sem meta</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {targetValue > 0 ? (
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-success' : progress >= 50 ? 'bg-primary' : 'bg-warning'}`} style={{ width: `${progress}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground w-10 text-right">{progress.toFixed(0)}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        {role === 'admin' && (
                          <TableCell>
                            <Dialog open={assignOpen === m.user_id} onOpenChange={(o) => { setAssignOpen(o ? m.user_id : null); setSelectedTeamForAssign(''); }}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 text-xs"><Users className="h-3 w-3 mr-1" />Equipe</Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-sm">
                                <DialogHeader><DialogTitle>Atribuir à Equipe</DialogTitle></DialogHeader>
                                <div className="space-y-3 py-2">
                                  <p className="text-sm text-muted-foreground">{m.profile?.full_name || 'Usuário'}</p>
                                  <Select value={selectedTeamForAssign} onValueChange={setSelectedTeamForAssign}>
                                    <SelectTrigger><SelectValue placeholder="Selecionar equipe" /></SelectTrigger>
                                    <SelectContent>
                                      {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <DialogFooter>
                                  <Button size="sm" disabled={!selectedTeamForAssign} onClick={() => handleAssignToTeam(m.user_id)}>Atribuir</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {members.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum membro encontrado</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Teams Tab */}
        <TabsContent value="teams">
          <div className="space-y-4">
            {role === 'admin' && (
              <div className="flex justify-end">
                <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 mr-2" />Nova Equipe</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-sm">
                    <DialogHeader><DialogTitle>Criar Equipe</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateTeam} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nome da equipe</Label>
                        <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Ex: Vendas, Marketing" required maxLength={50} />
                      </div>
                      <Button type="submit" className="w-full" disabled={teamSaving}>{teamSaving ? 'Criando...' : 'Criar Equipe'}</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {teams.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhuma equipe criada</p>
                  <p className="text-xs text-muted-foreground mt-1">Crie equipes para organizar seus vendedores</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map((team) => (
                  <Card key={team.id}>
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-foreground">{team.name}</p>
                            <p className="text-xs text-muted-foreground">{team.member_count} membro(s)</p>
                          </div>
                        </div>
                        {role === 'admin' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteTeam(team.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Invitations Tab */}
        <TabsContent value="invitations">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium text-sm text-foreground">{inv.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{inv.role === 'admin' ? 'Admin' : 'Vendedor'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={inv.status === 'pending' ? 'outline' : 'secondary'} className="text-xs">
                          {inv.status === 'pending' ? 'Pendente' : inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(inv.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  ))}
                  {invitations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum convite enviado</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
