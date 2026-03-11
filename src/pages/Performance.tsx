import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CircularProgress } from '@/components/CircularProgress';
import { useLossReasons } from '@/hooks/useLossReasons';
import { TrendingUp, Trophy, Target, Zap, Activity, DollarSign, PieChart as PieIcon } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell, PieChart, Pie,
} from 'recharts';

const STAGE_PROBABILITIES: Record<string, number> = {
  prospeccao: 10, qualificacao: 30, proposta: 50, negociacao: 75, fechado: 100, perdido: 0,
};

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
      {label && <p className="font-semibold text-foreground">Dia {label}</p>}
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: <strong>{typeof entry.value === 'number' ? formatCurrency(entry.value) : entry.value}</strong>
        </p>
      ))}
    </div>
  );
};

export default function Performance() {
  const { user } = useAuth();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const currentDay = now.getDate();

  const { data: allDeals = [] } = useQuery({
    queryKey: ['perf-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('id, name, value, stage, owner_id, created_at, updated_at, loss_reason');
      if (error) throw error;
      return data;
    },
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['perf-goals', currentMonth, currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_goals').select('*').eq('month', currentMonth).eq('year', currentYear);
      if (error) throw error;
      return data;
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
      const { data, error } = await supabase
        .from('activities').select('created_by')
        .gte('activity_date', startOfMonth).lte('activity_date', endOfMonth);
      if (error) throw error;
      return data;
    },
  });

  const getProfile = (userId: string) => profiles.find(p => p.user_id === userId);
  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  };

  const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
  const closedThisMonth = allDeals.filter(d => d.stage === 'fechado' && new Date(d.updated_at) >= startOfMonth);
  const closedValue = closedThisMonth.reduce((s, d) => s + (Number(d.value) || 0), 0);

  const totalGoalValue = goals.reduce((s, g: any) => s + (Number(g.target_value) || 0), 0);
  const goalPercent = totalGoalValue > 0 ? (closedValue / totalGoalValue) * 100 : 0;

  // Burn-up
  const burnUpData = [];
  let cumulative = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    if (day <= currentDay) {
      const dayDeals = closedThisMonth.filter(d => {
        const closedDate = new Date(d.updated_at);
        return closedDate.getDate() <= day && closedDate.getMonth() === currentMonth - 1;
      });
      cumulative = dayDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
    }
    burnUpData.push({
      day: `${day}`,
      ideal: totalGoalValue > 0 ? Math.round((totalGoalValue / daysInMonth) * day) : 0,
      realizado: day <= currentDay ? cumulative : undefined,
    });
  }

  // Leaderboard
  const ownerIds = [...new Set(allDeals.map(d => d.owner_id))];
  const leaderboard = ownerIds.map(ownerId => {
    const userDeals = allDeals.filter(d => d.owner_id === ownerId);
    const closedDeals = userDeals.filter(d => d.stage === 'fechado');
    const cv = closedDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
    const winRate = userDeals.length > 0 ? Math.round((closedDeals.length / userDeals.length) * 100) : 0;
    const userActivities = activitiesCounts.filter(a => a.created_by === ownerId).length;
    const profile = getProfile(ownerId);
    return { userId: ownerId, name: profile?.full_name || 'Sem nome', closedValue: cv, winRate, activities: userActivities, totalDeals: userDeals.length };
  }).sort((a, b) => b.closedValue - a.closedValue);

  // Forecast
  const pipelineDeals = allDeals.filter(d => d.stage !== 'fechado' && d.stage !== 'perdido');
  const weightedPipeline = pipelineDeals.reduce((s, d) => {
    const prob = STAGE_PROBABILITIES[d.stage] || 10;
    return s + (Number(d.value) || 0) * (prob / 100);
  }, 0);
  const forecast = closedValue + weightedPipeline;
  const forecastVsGoal = totalGoalValue > 0 ? Math.round((forecast / totalGoalValue) * 100) : 0;

  // Loss analysis
  const lostDeals = allDeals.filter(d => d.stage === 'perdido' && d.loss_reason);
  const lossReasonCounts: Record<string, number> = {};
  lostDeals.forEach(d => {
    const r = d.loss_reason!;
    lossReasonCounts[r] = (lossReasonCounts[r] || 0) + 1;
  });
  const lossData = Object.entries(lossReasonCounts).map(([key, count]) => {
    const found = LOSS_REASONS.find(r => r.value === key);
    return { name: found?.label || key, value: count };
  }).sort((a, b) => b.value - a.value);

  // Bar chart data
  const barData = leaderboard.slice(0, 8).map(l => ({
    name: l.name.split(' ')[0],
    valor: l.closedValue,
  }));

  const MONTHS_PT = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Performance</h1>
          <p className="text-sm text-muted-foreground">{MONTHS_PT[currentMonth]} {currentYear} · Dia {currentDay} de {daysInMonth}</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
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
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Meta Total</p>
                <p className="text-xl font-display font-bold text-foreground">{formatCurrency(totalGoalValue)}</p>
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
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Atividades no Mês</p>
                <p className="text-xl font-display font-bold text-foreground">{activitiesCounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Circular progress for team goal */}
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Burn-up */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Burn-up de Metas — {MONTHS_PT[currentMonth]}
          </CardTitle>
        </CardHeader>
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
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              Defina metas na aba Equipe para visualizar o burn-up
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-warning" />
              Leaderboard de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {leaderboard.slice(0, 10).map((seller, idx) => (
              <div key={seller.userId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  idx === 0 ? 'bg-warning/20 text-warning' :
                  idx === 1 ? 'bg-muted text-muted-foreground' :
                  idx === 2 ? 'bg-accent/20 text-accent-foreground' :
                  'bg-muted/50 text-muted-foreground'
                }`}>{idx + 1}</span>
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">{getInitials(seller.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{seller.name}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>Win Rate: <strong className="text-foreground">{seller.winRate}%</strong></span>
                    <span>Atividades: <strong className="text-foreground">{seller.activities}</strong></span>
                  </div>
                </div>
                <p className="text-sm font-bold text-primary shrink-0">{formatCurrency(seller.closedValue)}</p>
              </div>
            ))}
            {leaderboard.length === 0 && (
              <p className="text-center text-muted-foreground py-6 text-xs">Sem dados ainda</p>
            )}
          </CardContent>
        </Card>

        {/* Revenue bar chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-success" />
              Receita por Vendedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]} name="Valor Fechado">
                    {barData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? 'hsl(var(--primary))' : `hsl(var(--primary) / ${0.7 - i * 0.06})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Sem dados</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Loss Analysis Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-destructive" />
            Análise de Perdas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lossData.length > 0 ? (
            <div className="flex flex-col lg:flex-row items-center gap-6">
              <ResponsiveContainer width={280} height={280}>
                <PieChart>
                  <Pie
                    data={lossData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    strokeWidth={0}
                  >
                    {lossData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0];
                      return (
                        <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
                          <p className="font-semibold text-foreground">{p.name}</p>
                          <p className="text-muted-foreground">{p.value} negócio{(p.value as number) > 1 ? 's' : ''} perdido{(p.value as number) > 1 ? 's' : ''}</p>
                        </div>
                      );
                    }}
                  />
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
                <p className="text-[10px] text-muted-foreground pt-2">Total: {lostDeals.length} negócio{lostDeals.length > 1 ? 's' : ''} perdido{lostDeals.length > 1 ? 's' : ''}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              Nenhum negócio perdido com motivo registrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
