import { useState, useMemo } from 'react';
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
import { Label } from '@/components/ui/label';
import { TrendingUp, Trophy, Target, Zap, Activity, DollarSign, PieChart as PieIcon, Percent, AlertTriangle, CheckSquare, Clock, Info, Handshake } from 'lucide-react';
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
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

/** Simple linear regression: returns slope (m) and intercept (b) */
function linearRegression(data: number[]): { m: number; b: number } {
  const n = data.length;
  if (n < 2) return { m: 0, b: data[0] || 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += i * data[i];
    sumXX += i * i;
  }
  const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const b = (sumY - m * sumX) / n;
  return { m, b };
}

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
  const [showNoActivity, setShowNoActivity] = useState(false);

  const { data: allDeals = [] } = useQuery({
    queryKey: ['perf-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('id, name, value, stage, owner_id, created_at, updated_at, close_date, loss_reason, profit_margin, business_area, market, proposal_id, company_id, tipo_negocio, vendedor_externo, last_activity_at, companies(name)');
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

  // Apply global filters to ALL data
  const filteredDeals = useMemo(() => allDeals.filter(d => {
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
  }), [allDeals, filterArea, filterMarket, filterValueRange]);

  const periodDeals = useMemo(() => filteredDeals.filter(d => {
    const ref = d.stage === 'fechado' && d.close_date ? new Date(d.close_date) : new Date(d.updated_at);
    return ref >= periodStart;
  }), [filteredDeals, periodStart]);

  const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
  const closedInPeriod = useMemo(() => filteredDeals.filter(d => d.stage === 'fechado' && new Date(d.updated_at) >= periodStart), [filteredDeals, periodStart]);
  const closedValue = closedInPeriod.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);

  // Win Rate
  const proposalsSent = periodDeals.filter(d => ['proposta', 'negociacao', 'fechado', 'perdido'].includes(d.stage) || d.proposal_id);
  const winRate = proposalsSent.length > 0 ? (closedInPeriod.length / proposalsSent.length) * 100 : 0;

  // Historical probability (also filtered)
  const historicalWon = filteredDeals.filter(d => d.stage === 'fechado');
  const historicalTotal = filteredDeals.filter(d => d.stage === 'fechado' || d.stage === 'perdido');
  const historicalProb = historicalTotal.length > 0 ? (historicalWon.length / historicalTotal.length) * 100 : 0;

  // Profit
  const totalProfit = closedInPeriod.reduce((s: number, d: any) => {
    const margin = Number(d.profit_margin) || 0;
    const value = Number(d.value) || 0;
    return s + (value * margin / 100);
  }, 0);
  const avgProfitMargin = closedInPeriod.length > 0
    ? closedInPeriod.reduce((s: number, d: any) => s + (Number(d.profit_margin) || 0), 0) / closedInPeriod.length
    : 0;

  const totalGoalValue = goals.reduce((s: number, g: any) => s + (Number(g.target_value) || 0), 0);
  const goalPercent = totalGoalValue > 0 ? (closedValue / totalGoalValue) * 100 : 0;

  // Actionable metrics (filtered)
  const activeDeals = filteredDeals.filter(d => d.stage !== 'fechado' && d.stage !== 'perdido');
  const dealIdsWithPendingTasks = new Set(allTasks.filter(t => !t.completed && t.deal_id).map(t => t.deal_id));
  const dealsWithNoTasks = activeDeals.filter(d => !dealIdsWithPendingTasks.has(d.id));

  const todayStr = now.toISOString().split('T')[0];
  const overdueTasks = allTasks.filter(t => !t.completed && t.due_date && t.due_date < todayStr);
  const overdueDeals = [...new Set(overdueTasks.filter(t => t.deal_id).map(t => t.deal_id))];

  // Deals without recent activity (>7 days)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dealsNoRecentActivity = useMemo(() => activeDeals
    .map(d => {
      const lastAct = d.last_activity_at ? new Date(d.last_activity_at) : null;
      if (lastAct && lastAct >= sevenDaysAgo) return null;
      const refDate = lastAct || new Date(d.created_at);
      const diffDays = Math.floor((now.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
      return { ...d, daysSinceActivity: diffDays };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.daysSinceActivity - a.daysSinceActivity) as any[],
  [activeDeals, sevenDaysAgo]);

  // Burn-up
  const burnUpData: any[] = [];
  let cumulative = 0;
  const closedThisMonth = filteredDeals.filter(d => d.stage === 'fechado' && new Date(d.updated_at) >= startOfMonth);
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

  // Leaderboard (filtered)
  const ownerIds = [...new Set(filteredDeals.map((d: any) => d.owner_id))];
  const leaderboard = ownerIds.map(ownerId => {
    const userDeals = filteredDeals.filter((d: any) => d.owner_id === ownerId);
    const closedDeals = userDeals.filter((d: any) => d.stage === 'fechado');
    const cv = closedDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);
    const profit = closedDeals.reduce((s: number, d: any) => s + ((Number(d.value) || 0) * (Number(d.profit_margin) || 0) / 100), 0);
    const wr = userDeals.length > 0 ? Math.round((closedDeals.length / userDeals.length) * 100) : 0;
    const userActivities = activitiesCounts.filter((a: any) => a.created_by === ownerId).length;
    const profile = getProfile(ownerId);
    return { userId: ownerId, name: profile?.full_name || 'Sem nome', closedValue: cv, profit, winRate: wr, activities: userActivities, totalDeals: userDeals.length };
  }).sort((a, b) => b.closedValue - a.closedValue);

  // Forecast (filtered)
  const pipelineDeals = filteredDeals.filter((d: any) => d.stage !== 'fechado' && d.stage !== 'perdido');
  const forecast = closedValue + pipelineDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0) * (historicalProb / 100), 0);
  const forecastVsGoal = totalGoalValue > 0 ? Math.round((forecast / totalGoalValue) * 100) : 0;

  // Loss analysis (filtered)
  const lostDeals = filteredDeals.filter((d: any) => d.stage === 'perdido' && d.loss_reason);
  const lossReasonCounts: Record<string, number> = {};
  lostDeals.forEach((d: any) => { lossReasonCounts[d.loss_reason!] = (lossReasonCounts[d.loss_reason!] || 0) + 1; });
  const lossData = Object.entries(lossReasonCounts).map(([key, count]) => {
    const found = lossReasonsList.find((r: any) => r.value === key);
    const lostValue = lostDeals.filter((d: any) => d.loss_reason === key).reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);
    return { name: found?.label || key, value: count, lostValue };
  }).sort((a, b) => b.value - a.value);
  const totalLostValue = lostDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);

  // Revenue by tipo_negocio (filtered)
  const revenueByTipo = useMemo(() => {
    const map: Record<string, number> = {};
    filteredDeals.filter(d => d.stage === 'fechado').forEach((d: any) => {
      const key = d.tipo_negocio || 'Não informado';
      map[key] = (map[key] || 0) + (Number(d.value) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredDeals]);

  // Ranking de Vendedores Externos (filtered)
  const parceirosRanking = useMemo(() => {
    const map: Record<string, { total: number; won: number; count: number }> = {};
    filteredDeals.forEach((d: any) => {
      const v = d.vendedor_externo?.trim();
      if (!v) return;
      if (!map[v]) map[v] = { total: 0, won: 0, count: 0 };
      map[v].count++;
      if (d.stage === 'fechado') {
        map[v].total += Number(d.value) || 0;
        map[v].won++;
      }
    });
    return Object.entries(map)
      .map(([name, s]) => ({ name, total: s.total, winRate: s.count > 0 ? Math.round((s.won / s.count) * 100) : 0, deals: s.count, won: s.won }))
      .sort((a, b) => b.total - a.total);
  }, [filteredDeals]);

  const barData = leaderboard.slice(0, 8).map(l => ({ name: l.name.split(' ')[0], valor: l.closedValue, lucro: l.profit }));

  const MONTHS_PT = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  // Monthly revenue evolution with trendline (filtered)
  const monthlyRevenueData = useMemo(() => {
    const monthlyData: { month: string; receita: number; negocios: number; tendencia?: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const closed = filteredDeals.filter((deal: any) => {
        if (deal.stage !== 'fechado') return false;
        const u = new Date(deal.updated_at);
        return u.getFullYear() === y && u.getMonth() === m;
      });
      const label = `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][m]}/${String(y).slice(2)}`;
      monthlyData.push({ month: label, receita: closed.reduce((s: number, deal: any) => s + (Number(deal.value) || 0), 0), negocios: closed.length });
    }

    // Calculate linear regression trendline
    const values = monthlyData.map(d => d.receita);
    const { m, b } = linearRegression(values);
    monthlyData.forEach((d, i) => {
      d.tendencia = Math.max(0, Math.round(m * i + b));
    });

    return monthlyData;
  }, [filteredDeals, currentYear, currentMonth]);

  const InfoTip = ({ text }: { text: string }) => (
    <UITooltip>
      <TooltipTrigger asChild>
        <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help shrink-0" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </UITooltip>
  );

  return (
    <TooltipProvider delayDuration={200}>
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
        {/* Filters with Labels */}
        <div className="flex gap-3 flex-wrap items-end">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Área de Negócio</Label>
            <Select value={filterArea} onValueChange={setFilterArea}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Áreas</SelectItem>
                {BUSINESS_AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Mercado</Label>
            <Select value={filterMarket} onValueChange={setFilterMarket}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Público">Público</SelectItem>
                <SelectItem value="Privado">Privado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Período</Label>
            <Select value={filterPeriod} onValueChange={setFilterPeriod}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Mês Atual</SelectItem>
                <SelectItem value="quarter">Trimestre</SelectItem>
                <SelectItem value="year">Ano</SelectItem>
                <SelectItem value="all">Todo Período</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Faixa de Valor</Label>
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
      </div>

      {/* KPI cards row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-success" /></div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">Fechado no Período <InfoTip text="Valor total dos negócios fechados (ganhos) no período selecionado. Reage a todos os filtros globais." /></p>
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
                <p className="text-xs text-muted-foreground flex items-center gap-1">Lucro Total <InfoTip text="Soma do lucro estimado dos negócios fechados no período, calculado como Valor × Margem de Lucro (%)." /></p>
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
                <p className="text-xs text-muted-foreground flex items-center gap-1">Taxa de Fechamento <InfoTip text="Percentual de propostas enviadas que resultaram em fechamento no período selecionado." /></p>
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
                <p className="text-xs text-muted-foreground flex items-center gap-1">Prob. Histórica <InfoTip text="Probabilidade histórica de fechar negócios baseada em todo o histórico filtrado." /></p>
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
                <p className="text-xs text-muted-foreground flex items-center gap-1">Previsão (Forecast) <InfoTip text="Estimativa de receita: valor já fechado + pipeline ativo ponderado pela probabilidade histórica." /></p>
                <p className="text-xl font-display font-bold text-foreground">{formatCurrency(forecast)}</p>
                <p className="text-[10px] text-muted-foreground">{forecastVsGoal}% da meta</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actionable metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:border-warning/50 transition-colors" onClick={() => setShowNoTasks(true)}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <CheckSquare className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">Negócios sem tarefas pendentes <InfoTip text="Negócios ativos que não possuem nenhuma tarefa pendente. Clique para ver a lista e agir." /></p>
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
                <p className="text-xs text-muted-foreground flex items-center gap-1">Tarefas em atraso <InfoTip text="Total de tarefas não concluídas com data de vencimento ultrapassada. Clique para ver detalhes." /></p>
                <p className="text-2xl font-display font-bold text-destructive">{overdueTasks.length}</p>
                <p className="text-[10px] text-muted-foreground">Em {overdueDeals.length} negócio(s)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-orange-500/50 transition-colors" onClick={() => setShowNoActivity(true)}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">Sem atividades recentes <InfoTip text="Negócios ativos que estão há mais de 7 dias sem nenhuma atividade registrada. Clique para ver a lista." /></p>
                <p className="text-2xl font-display font-bold text-orange-500">{dealsNoRecentActivity.length}</p>
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
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Burn-up de Metas — {MONTHS_PT[currentMonth]} <InfoTip text="Gráfico de progresso acumulado. A linha tracejada mostra o ritmo ideal para atingir a meta. A linha sólida mostra o valor realizado dia a dia." /></CardTitle></CardHeader>
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

      {/* Monthly Revenue Evolution with Trendline */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />Evolução Mensal da Receita <InfoTip text="Comparativo mês a mês da receita fechada nos últimos 12 meses com linha de tendência (regressão linear). Reage a todos os filtros globais." /></CardTitle></CardHeader>
        <CardContent>
          {(() => {
            const hasData = monthlyRevenueData.some(m => m.receita > 0);
            if (!hasData) return <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Sem dados de receita nos últimos 12 meses</div>;
            return (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line yAxisId="left" type="monotone" dataKey="receita" stroke="hsl(var(--primary))" name="Receita" strokeWidth={2.5} dot={{ r: 3, fill: 'hsl(var(--primary))' }} />
                  <Line yAxisId="left" type="monotone" dataKey="tendencia" stroke="hsl(var(--destructive))" name="Linha de Tendência" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="negocios" stroke="hsl(var(--success))" name="Negócios Fechados" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--success))' }} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            );
          })()}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leaderboard */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4 text-warning" />Leaderboard de Vendas <InfoTip text="Ranking dos vendedores ordenado por valor total fechado. Reage a todos os filtros globais." /></CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-success" />Receita e Lucro por Vendedor <InfoTip text="Comparativo visual entre o valor total fechado e o lucro estimado de cada vendedor." /></CardTitle></CardHeader>
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

      {/* Revenue by Tipo de Negócio + Ranking Vendedores Externos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut: Origem de Receita */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><PieIcon className="h-4 w-4 text-primary" />Origem de Receita <InfoTip text="Distribuição da receita fechada por tipo de negócio (Novo Cliente vs Cliente Existente). Reage a todos os filtros globais." /></CardTitle></CardHeader>
          <CardContent>
            {revenueByTipo.length > 0 ? (
              <div className="flex flex-col lg:flex-row items-center gap-6">
                <ResponsiveContainer width={260} height={260}>
                  <PieChart>
                    <Pie data={revenueByTipo} cx="50%" cy="50%" innerRadius={55} outerRadius={100} paddingAngle={4} dataKey="value" nameKey="name" strokeWidth={0}>
                      {revenueByTipo.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0];
                      return (
                        <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
                          <p className="font-semibold text-foreground">{p.name}</p>
                          <p className="text-muted-foreground">{formatCurrency(p.value as number)}</p>
                        </div>
                      );
                    }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {revenueByTipo.map((item, i) => {
                    const total = revenueByTipo.reduce((s, r) => s + r.value, 0);
                    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                    return (
                      <div key={item.name} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-sm text-foreground flex-1">{item.name}</span>
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                        <span className="text-xs font-semibold text-foreground">{formatCurrency(item.value)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Nenhum negócio fechado com tipo de negócio informado</div>
            )}
          </CardContent>
        </Card>

        {/* Table: Ranking de Vendedores Externos */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Handshake className="h-4 w-4 text-primary" />Ranking de Vendedores Externos <InfoTip text="Ranking dos vendedores externos ordenado por valor total fechado. Reage a todos os filtros globais." /></CardTitle></CardHeader>
          <CardContent>
            {parceirosRanking.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">Vendedor</TableHead>
                    <TableHead className="text-xs text-right">Valor Fechado</TableHead>
                    <TableHead className="text-xs text-right">Win Rate</TableHead>
                    <TableHead className="text-xs text-right">Negócios</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parceirosRanking.slice(0, 10).map((p, idx) => (
                    <TableRow key={p.name}>
                      <TableCell className="font-bold text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{formatCurrency(p.total)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={p.winRate >= 50 ? 'default' : 'secondary'} className="text-[10px]">{p.winRate}%</Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">{p.won}/{p.deals}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Nenhum negócio com vendedor externo registrado</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Loss Analysis */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><PieIcon className="h-4 w-4 text-destructive" />Análise de Perdas <InfoTip text="Distribuição dos motivos de perda de negócios. Reage a todos os filtros globais." /></CardTitle></CardHeader>
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
                    <span className="text-sm text-foreground flex-1">{item.name}</span>
                    <span className="text-xs text-muted-foreground">{formatCurrency(item.lostValue)}</span>
                    <Badge variant="secondary" className="text-[10px] ml-1">{item.value}</Badge>
                  </div>
                ))}
                <div className="border-t border-border pt-2 mt-2">
                  <p className="text-xs text-muted-foreground">Total: {lostDeals.length} negócio{lostDeals.length > 1 ? 's' : ''} · <strong className="text-destructive">{formatCurrency(totalLostValue)}</strong></p>
                </div>
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

      {/* Modal: Deals without recent activity */}
      <Dialog open={showNoActivity} onOpenChange={setShowNoActivity}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-orange-500" />Negócios sem Atividades Recentes</DialogTitle></DialogHeader>
          {dealsNoRecentActivity.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Negócio</TableHead><TableHead>Empresa</TableHead><TableHead className="text-right">Dias sem atividade</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {dealsNoRecentActivity.map((d: any) => (
                  <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setShowNoActivity(false); navigate(`/deals/${d.id}`); }}>
                    <TableCell className="font-medium text-primary">{d.proposal_id || d.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{d.companies?.name || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={d.daysSinceActivity > 30 ? 'destructive' : 'secondary'} className="text-[10px]">
                        {d.daysSinceActivity} dias
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-6 text-sm">Todos os negócios têm atividades recentes 🎉</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}