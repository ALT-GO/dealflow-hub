import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, Users, Briefcase, Settings } from 'lucide-react';

type PropertyDef = {
  name: string;
  label: string;
  type: string;
  required: boolean;
  default?: string;
};

const companyProperties: PropertyDef[] = [
  { name: 'name', label: 'Nome', type: 'Texto', required: true },
  { name: 'domain', label: 'Domínio', type: 'Texto', required: false },
  { name: 'sector', label: 'Setor', type: 'Texto', required: false },
  { name: 'phone', label: 'Telefone', type: 'Texto', required: false },
  { name: 'created_by', label: 'Proprietário', type: 'Referência (Usuário)', required: false },
  { name: 'created_at', label: 'Data de criação', type: 'Data/hora', required: true },
  { name: 'updated_at', label: 'Data da última modificação', type: 'Data/hora', required: true },
];

const contactProperties: PropertyDef[] = [
  { name: 'name', label: 'Nome', type: 'Texto', required: true },
  { name: 'email', label: 'E-mail', type: 'E-mail', required: false },
  { name: 'role', label: 'Cargo', type: 'Texto', required: false },
  { name: 'company_id', label: 'Empresa', type: 'Referência (Empresa)', required: true },
  { name: 'lead_source', label: 'Origem do Lead', type: 'Dropdown', required: false, default: '-' },
  { name: 'status', label: 'Status do Contato', type: 'Dropdown', required: false, default: 'novo' },
  { name: 'created_by', label: 'Proprietário', type: 'Referência (Usuário)', required: false },
  { name: 'created_at', label: 'Data de criação', type: 'Data/hora', required: true },
  { name: 'updated_at', label: 'Data da última modificação', type: 'Data/hora', required: true },
];

const dealProperties: PropertyDef[] = [
  { name: 'name', label: 'Nome do Negócio', type: 'Texto', required: true },
  { name: 'value', label: 'Valor', type: 'Moeda', required: false, default: '0' },
  { name: 'stage', label: 'Etapa do Funil', type: 'Dropdown', required: true, default: 'prospeccao' },
  { name: 'close_date', label: 'Data de Fechamento', type: 'Data', required: false },
  { name: 'company_id', label: 'Empresa', type: 'Referência (Empresa)', required: true },
  { name: 'contact_id', label: 'Contato', type: 'Referência (Contato)', required: false },
  { name: 'owner_id', label: 'Proprietário', type: 'Referência (Usuário)', required: true },
  { name: 'created_at', label: 'Data de criação', type: 'Data/hora', required: true },
  { name: 'updated_at', label: 'Data da última modificação', type: 'Data/hora', required: true },
];

function PropertiesTable({ properties }: { properties: PropertyDef[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campo</TableHead>
              <TableHead>Nome interno</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Obrigatório</TableHead>
              <TableHead>Padrão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((p) => (
              <TableRow key={p.name}>
                <TableCell className="font-medium text-foreground">{p.label}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">{p.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">{p.type}</Badge>
                </TableCell>
                <TableCell>
                  {p.required ? (
                    <Badge className="bg-primary/10 text-primary text-xs">Sim</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">Não</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{p.default || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function PropertiesSettings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Configurações de Propriedades</h1>
          <p className="text-sm text-muted-foreground">Visualize os campos de cada objeto do CRM</p>
        </div>
      </div>

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies" className="gap-1.5">
            <Building2 className="h-4 w-4" />Empresas
          </TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1.5">
            <Users className="h-4 w-4" />Contatos
          </TabsTrigger>
          <TabsTrigger value="deals" className="gap-1.5">
            <Briefcase className="h-4 w-4" />Negócios
          </TabsTrigger>
        </TabsList>
        <TabsContent value="companies" className="mt-4">
          <PropertiesTable properties={companyProperties} />
        </TabsContent>
        <TabsContent value="contacts" className="mt-4">
          <PropertiesTable properties={contactProperties} />
        </TabsContent>
        <TabsContent value="deals" className="mt-4">
          <PropertiesTable properties={dealProperties} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
