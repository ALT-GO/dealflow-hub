import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building2, Users, Briefcase } from 'lucide-react';
import { CsvImport } from '@/components/CsvImport';

export function ImportTab() {
  return (
    <div className="space-y-4 pt-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Importar Empresas</CardTitle>
              <CardDescription>Importe empresas a partir de um arquivo CSV ou TXT</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CsvImport entityType="companies" onComplete={() => {}} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Importar Contatos</CardTitle>
              <CardDescription>Importe contatos vinculados a empresas existentes</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CsvImport entityType="contacts" onComplete={() => {}} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Briefcase className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Importar Negócios</CardTitle>
              <CardDescription>Importe negócios vinculados a empresas existentes</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CsvImport entityType="deals" onComplete={() => {}} />
        </CardContent>
      </Card>
    </div>
  );
}
