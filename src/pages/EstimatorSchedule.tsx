import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarRange } from 'lucide-react';
import EstimatorGantt from '@/components/EstimatorGantt';

export default function EstimatorSchedule() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ocupação da Equipe</h1>
        <p className="text-sm text-muted-foreground">Visualize a alocação dos orçamentistas em negócios e propostas.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Gantt — Orçamentistas</CardTitle>
          </div>
          <CardDescription>Cada bloco representa um negócio atribuído ao orçamentista. Período: Data Início Orçamento até Data Entrega Proposta.</CardDescription>
        </CardHeader>
        <CardContent>
          <EstimatorGantt />
        </CardContent>
      </Card>
    </div>
  );
}
