import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CircularProgress } from '@/components/CircularProgress';
import { useLossReasons } from '@/hooks/useLossReasons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, Trophy, Target, Zap, Activity, DollarSign, PieChart as PieIcon, Percent, AlertTriangle, CheckSquare, Clock } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell, PieChart, Pie,
} from 'recharts';

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(var(--accent))',
  'hsl(var(--success))',
  'hsl(var(--muted-foreground))',
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs space-y-1">
      {label && <p className="font-semibold text-foreground">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: <strong>{typeof entry.value === 'number' ? (entry.name.includes('%') || entry.name.includes('Taxa') ? `${entry.value.toFixed(1)}%` : formatCurrency(entry.value)) : entry.value}</strong>
        </p>
      ))}
    </div>
  );
};

const BUSINESS_AREAS = ['Infraestrutura Predial', 'Missão Crítica', 'Segurança Eletrônica', 'Inteligência Predial', 'Energia', 'Outro'];

export default function Performance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: lossReasonsList = [] } = useLossReasons();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const currentDay = now.getDate();

  // Filters
  const [filterArea, setFilterArea] = useState<string>('all');
  const [filterMarket, setFilterMarket] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('month');
  const [filterValueRange, setFilterValueRange] = useState<string>('all');

  // Modals
  const [showNoTasks, setShowNoTasks] = useState(false);
  const [showOverdue, setShowOverdue] = useState(false);

  const { data: allDeals = [] } = useQuery({
    queryKey: ['perf-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('id, name, value, stage, owner_id, created_at, updated_at, loss_reason, profit_margin, business_area, market, proposal_id, company_id, companies(name)');
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['perf-goals', currentMonth, currentYear],
    queryFn: async () => {
      const { data } = await supabase.from('sales_goals').select('*').eq('month', currentMonth).eq('year', currentYear);
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-all'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
  });

  const { data: activitiesCounts = [] } = useQuery({
    queryKey: ['perf-activities', currentMonth, currentYear],
    queryFn: async () => {
      const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const endOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${daysInMonth}T23:59:59`;
      const { data } = await supabase.from('activities').select('created_by').gte('activity_date', startOfMonth).lte('activity_date', endOfMonth);
      return data || [];
    },
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['perf-tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('id, title, deal_id, completed, due_date, assigned_to');
      return data || [];
    },
  });

  const getProfile = (userId: string) => profiles.find(p => p.user_id === userId);
  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  };

  // Period filter logic
  const getStartDate = () => {
    if (filterPeriod === 'quarter') {
      const q = Math.floor((currentMonth - 1) / 3) * 3;
      return new Date(currentYear, q, 1);
    }
    if (filterPeriod === 'year') return new Date(currentYear, 0, 1);
    if (filterPeriod === 'all') return new Date(2000, 0, 1);
    return new Date(currentYear, currentMonth - 1, 1);
  };
  const periodStart = getStartDate();

  // Apply filters
  const filteredDeals = allDeals.filter(d => {
    if (filterArea !== 'all' && d.business_area !== filterArea) return false;
    if (filterMarket !== 'all' && d.market !== filterMarket) return false;
    if (filterValueRange !== 'all') {
      const v = Number(d.value) || 0;
      if (filterValueRange === '0-50k' && v > 50000) return false;
      if (filterValueRange === '50k-500k' && (v < 50000 || v > 500000)) return false;
      if (filterValueRange === '500k-5m' && (v < 500000 || v > 5000000)) return false;
      if (filterValueRange === '5m+' && v < 5000000) return false;
    }
    return true;
  });

  const periodDeals = filteredDeals.filter(d => new Date(d.updated_at) >= periodStart);

  const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
  const closedThisMonth = filteredDeals.filter(d => d.stage === 'fechado' && new Date(d.updated_at) >= startOfMonth);
  const closedValue = closedThisMonth.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);

  // === NEW KPIs ===
  // Win Rate: proposals sent (stage >= proposta) vs closed
  const proposalsSent = periodDeals.filter(d => ['proposta', 'negociacao', 'fechado', 'perdido'].includes(d.stage) || d.proposal_id);
  const closedInPeriod = periodDeals.filter(d => d.stage === 'fechado');
  const winRate = proposalsSent.length > 0 ? (closedInPeriod.length / proposalsSent.length) * 100 : 0;

  // Historical probability by area/market
  const historicalWon = allDeals.filter(d => d.stage === 'fechado');
  const historicalTotal = allDeals.filter(d => d.stage === 'fechado' || d.stage === 'perdido');
  const historicalProb = historicalTotal.length > 0 ? (historicalWon.length / historicalTotal.length) * 100 : 0;

  // Profit
  const totalProfit = closedThisMonth.reduce((s: number, d: any) => {
    const margin = Number(d.profit_margin) || 0;
    const value = Number(d.value) || 0;
    return s + (value * margin / 100);
  }, 0);
  const avgProfitMargin = closedThisMonth.length > 0
    ? closedThisMonth.reduce((s: number, d: any) => s + (Number(d.profit_margin) || 0), 0) / closedThisMonth.length
    : 0;

  const totalGoalValue = goals.reduce((s: number, g: any) => s + (Number(g.target_value) || 0), 0);
  const goalPercent = totalGoalValue > 0 ? (closedValue / totalGoalValue) * 100 : 0;

  // Actionable metrics
  const activeDeals = allDeals.filter(d => d.stage !== 'fechado' && d.stage !== 'perdido');
  const dealIdsWithPendingTasks = new Set(allTasks.filter(t => !t.completed && t.deal_id).map(t => t.deal_id));
  const dealsWithNoTasks = activeDeals.filter(d => !dealIdsWithPendingTasks.has(d.id));

  const todayStr = now.toISOString().split('T')[0];
  const overdueTasks = allTasks.filter(t => !t.completed && t.due_date && t.due_date < todayStr);
  const overdueDeals = [...new Set(overdueTasks.filter(t => t.deal_id).map(t => t.deal_id))];

  // Burn-up
  const burnUpData: any[] = [];
  let cumulative = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    if (day <= currentDay) {
      const dayDeals = closedThisMonth.filter((d: any) => new Date(d.updated_at).getDate() <= day && new Date(d.updated_at).getMonth() === currentMonth - 1);
      cumulative = dayDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);
    }
    burnUpData.push({
      day: `${day}`,
      ideal: totalGoalValue > 0 ? Math.round((totalGoalValue / daysInMonth) * day) : 0,
      realizado: day <= currentDay ? cumulative : undefined,
    });
  }

  // Leaderboard
  const ownerIds = [...new Set(allDeals.map((d: any) => d.owner_id))];
  const leaderboard = ownerIds.map(ownerId => {
    const userDeals = allDeals.filter((d: any) => d.owner_id === ownerId);
    const closedDeals = userDeals.filter((d: any) => d.stage === 'fechado');
    const cv = closedDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);
    const profit = closedDeals.reduce((s: number, d: any) => s + ((Number(d.value) || 0) * (Number(d.profit_margin) || 0) / 100), 0);
    const wr = userDeals.length > 0 ? Math.round((closedDeals.length / userDeals.length) * 100) : 0;
    const userActivities = activitiesCounts.filter((a: any) => a.created_by === ownerId).length;
    const profile = getProfile(ownerId);
    return { userId: ownerId, name: profile?.full_name || 'Sem nome', closedValue: cv, profit, winRate: wr, activities: userActivities, totalDeals: userDeals.length };
  }).sort((a, b) => b.closedValue - a.closedValue);

  // Forecast using historical probability
  const pipelineDeals = allDeals.filter((d: any) => d.stage !== 'fechado' && d.stage !== 'perdido');
  const forecast = closedValue + pipelineDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0) * (historicalProb / 100), 0);
  const forecastVsGoal = totalGoalValue > 0 ? Math.round((forecast / totalGoalValue) * 100) : 0;

  // Loss analysis
  const lostDeals = allDeals.filter((d: any) => d.stage === 'perdido' && d.loss_reason);
  const lossReasonCounts: Record<string, number> = {};
  lostDeals.forEach((d: any) => { lossReasonCounts[d.loss_reason!] = (lossReasonCounts[d.loss_reason!] || 0) + 1; });
  const lossData = Object.entries(lossReasonCounts).map(([key, count]) => {
    const found = lossReasonsList.find((r: any) => r.value === key);
    return { name: found?.label || key, value: count };
  }).sort((a, b) => b.value - a.value);

  const barData = leaderboard.slice(0, 8).map(l => ({ name: l.name.split(' ')[0], valor: l.closedValue, lucro: l.profit }));

  const MONTHS_PT = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Performance</h1>
            <p className="text-sm text-muted-foreground">{MONTHS_PT[currentMonth]} {currentYear} · Dia {currentDay} de {daysInMonth}</p>
          </div>
        </div>
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <Select value={filterArea} onValueChange={setFilterArea}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Áreas</SelectItem>
              {BUSINESS_AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterMarket} onValueChange={setFilterMarket}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Mercados</SelectItem>
              <SelectItem value="Público">Público</SelectItem>
              <SelectItem value="Privado">Privado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPeriod} onValueChange={setFilterPeriod}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mês Atual</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
              <SelectItem value="year">Ano</SelectItem>
              <SelectItem value="all">Todo Período</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterValueRange} onValueChange={setFilterValueRange}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Faixas</SelectItem>
              <SelectItem value="0-50k">Até R$ 50k</SelectItem>
              <SelectItem value="50k-500k">R$ 50k – 500k</SelectItem>
              <SelectItem value="500k-5m">R$ 500k – 5M</SelectItem>
              <SelectItem value="5m+">Acima de R$ 5M</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI cards row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-success" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Fechado no Mês</p>
                <p className="text-xl font-display font-bold text-foreground">{formatCurrency(closedValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Percent className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Lucro Total</p>
                <p className="text-xl font-display font-bold text-emerald-600">{formatCurrency(totalProfit)}</p>
                {avgProfitMargin > 0 && <p className="text-[10px] text-muted-foreground">Margem média: {avgProfitMargin.toFixed(1)}%</p>}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Target className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Taxa de Fechamento</p>
                <p className="text-xl font-display font-bold text-foreground">{winRate.toFixed(1)}%</p>
                <p className="text-[10px] text-muted-foreground">{closedInPeriod.length}/{proposalsSent.length} propostas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center"><Activity className="h-5 w-5 text-accent" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Prob. Histórica</p>
                <p className="text-xl font-display font-bold text-foreground">{historicalProb.toFixed(1)}%</p>
                <p className="text-[10px] text-muted-foreground">{historicalWon.length}/{historicalTotal.length} finalizados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={forecastVsGoal >= 100 ? 'border-success/30' : forecastVsGoal >= 70 ? 'border-primary/30' : 'border-warning/30'}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${forecastVsGoal >= 100 ? 'bg-success/10' : forecastVsGoal >= 70 ? 'bg-primary/10' : 'bg-warning/10'}`}>
                <Zap className={`h-5 w-5 ${forecastVsGoal >= 100 ? 'text-success' : forecastVsGoal >= 70 ? 'text-primary' : 'text-warning'}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Previsão (Forecast)</p>
                <p className="text-xl font-display font-bold text-foreground">{formatCurrency(forecast)}</p>
                <p className="text-[10px] text-muted-foreground">{forecastVsGoal}% da meta</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actionable metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:border-warning/50 transition-colors" onClick={() => setShowNoTasks(true)}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <CheckSquare className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Negócios sem tarefas pendentes</p>
                <p className="text-2xl font-display font-bold text-warning">{dealsWithNoTasks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-destructive/50 transition-colors" onClick={() => setShowOverdue(true)}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tarefas em atraso</p>
                <p className="text-2xl font-display font-bold text-destructive">{overdueTasks.length}</p>
                <p className="text-[10px] text-muted-foreground">Em {overdueDeals.length} negócio(s)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goal progress */}
      {totalGoalValue > 0 && (
        <Card>
          <CardContent className="py-5 flex items-center gap-6">
            <CircularProgress value={goalPercent} label="da meta da equipe" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Equipe atingiu <strong className="text-primary">{formatCurrency(closedValue)}</strong> de {formatCurrency(totalGoalValue)}
              </p>
              <p className="text-xs text-muted-foreground">
                {goalPercent >= 100 ? '🎉 Meta batida!' : `Faltam ${formatCurrency(totalGoalValue - closedValue)}`}
              </p>
              {totalProfit > 0 && <p className="text-xs text-emerald-600 font-medium">Lucro acumulado: {formatCurrency(totalProfit)}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Burn-up */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Burn-up de Metas — {MONTHS_PT[currentMonth]}</CardTitle></CardHeader>
        <CardContent>
          {totalGoalValue > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={burnUpData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={4} />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="ideal" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" name="Ritmo Ideal" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="realizado" stroke="hsl(var(--primary))" name="Realizado" dot={false} strokeWidth={2.5} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Defina metas na aba Equipe para visualizar o burn-up</div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leaderboard */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4 text-warning" />Leaderboard de Vendas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {leaderboard.slice(0, 10).map((seller, idx) => (
              <div key={seller.userId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${idx === 0 ? 'bg-warning/20 text-warning' : idx === 1 ? 'bg-muted text-muted-foreground' : idx === 2 ? 'bg-accent/20 text-accent-foreground' : 'bg-muted/50 text-muted-foreground'}`}>{idx + 1}</span>
                <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">{getInitials(seller.name)}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{seller.name}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>Win Rate: <strong className="text-foreground">{seller.winRate}%</strong></span>
                    <span>Lucro: <strong className="text-emerald-600">{formatCurrency(seller.profit)}</strong></span>
                  </div>
                </div>
                <p className="text-sm font-bold text-primary shrink-0">{formatCurrency(seller.closedValue)}</p>
              </div>
            ))}
            {leaderboard.length === 0 && <p className="text-center text-muted-foreground py-6 text-xs">Sem dados ainda</p>}
          </CardContent>
        </Card>

        {/* Bar chart */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-success" />Receita e Lucro por Vendedor</CardTitle></CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]} name="Valor Fechado" fill="hsl(var(--primary))" />
                  <Bar dataKey="lucro" radius={[6, 6, 0, 0]} name="Lucro" fill="hsl(var(--success))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Sem dados</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Loss Analysis */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><PieIcon className="h-4 w-4 text-destructive" />Análise de Perdas</CardTitle></CardHeader>
        <CardContent>
          {lossData.length > 0 ? (
            <div className="flex flex-col lg:flex-row items-center gap-6">
              <ResponsiveContainer width={280} height={280}>
                <PieChart>
                  <Pie data={lossData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={3} dataKey="value" nameKey="name" strokeWidth={0}>
                    {lossData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0];
                    return (
                      <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
                        <p className="font-semibold text-foreground">{p.name}</p>
                        <p className="text-muted-foreground">{p.value} negócio{(p.value as number) > 1 ? 's' : ''}</p>
                      </div>
                    );
                  }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {lossData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-sm text-foreground">{item.name}</span>
                    <Badge variant="secondary" className="text-[10px] ml-auto">{item.value}</Badge>
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground pt-2">Total: {lostDeals.length} negócio{lostDeals.length > 1 ? 's' : ''}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Nenhum negócio perdido com motivo registrado</div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Deals without tasks */}
      <Dialog open={showNoTasks} onOpenChange={setShowNoTasks}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" />Negócios sem Tarefas Pendentes</DialogTitle></DialogHeader>
          {dealsWithNoTasks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Negócio</TableHead><TableHead>Empresa</TableHead><TableHead>Estágio</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {dealsWithNoTasks.map((d: any) => (
                  <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setShowNoTasks(false); navigate(`/deals/${d.id}`); }}>
                    <TableCell className="font-medium text-primary">{d.proposal_id || d.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{d.companies?.name || '-'}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{d.stage}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-6 text-sm">Todos os negócios têm tarefas pendentes 🎉</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Overdue tasks */}
      <Dialog open={showOverdue} onOpenChange={setShowOverdue}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-destructive" />Tarefas em Atraso</DialogTitle></DialogHeader>
          {overdueTasks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Tarefa</TableHead><TableHead>Vencimento</TableHead><TableHead>Responsável</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {overdueTasks.map((t: any) => {
                  const assignee = getProfile(t.assigned_to);
                  return (
                    <TableRow key={t.id} className={t.deal_id ? 'cursor-pointer hover:bg-muted/50' : ''} onClick={() => { if (t.deal_id) { setShowOverdue(false); navigate(`/deals/${t.deal_id}`); } }}>
                      <TableCell className="font-medium text-foreground">{t.title}</TableCell>
                      <TableCell className="text-destructive text-sm">{t.due_date}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{assignee?.full_name || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-6 text-sm">Nenhuma tarefa em atraso 🎉</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
