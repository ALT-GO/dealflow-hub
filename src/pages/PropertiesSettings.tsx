import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Building2, Users, Briefcase, Settings, Plus, Trash2 } from 'lucide-react';

type PropertyDef = {
  name: string;
  label: string;
  type: string;
  required: boolean;
  default?: string;
  isSystem: boolean;
};

type CustomProperty = {
  id: string;
  entity_type: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  default_value: string | null;
  dropdown_options: string[] | null;
};

const SYSTEM_PROPS: Record<string, PropertyDef[]> = {
  companies: [
    { name: 'name', label: 'Nome', type: 'Texto', required: true, isSystem: true },
    { name: 'domain', label: 'Domínio', type: 'Texto', required: false, isSystem: true },
    { name: 'sector', label: 'Setor', type: 'Texto', required: false, isSystem: true },
    { name: 'phone', label: 'Telefone', type: 'Texto', required: false, isSystem: true },
    { name: 'created_by', label: 'Proprietário', type: 'Referência', required: false, isSystem: true },
    { name: 'created_at', label: 'Data de criação', type: 'Data/hora', required: true, isSystem: true },
    { name: 'updated_at', label: 'Última modificação', type: 'Data/hora', required: true, isSystem: true },
  ],
  contacts: [
    { name: 'name', label: 'Nome', type: 'Texto', required: true, isSystem: true },
    { name: 'email', label: 'E-mail', type: 'E-mail', required: false, isSystem: true },
    { name: 'role', label: 'Cargo', type: 'Texto', required: false, isSystem: true },
    { name: 'company_id', label: 'Empresa', type: 'Referência', required: true, isSystem: true },
    { name: 'lead_source', label: 'Origem do Lead', type: 'Dropdown', required: false, isSystem: true },
    { name: 'status', label: 'Status', type: 'Dropdown', required: false, default: 'novo', isSystem: true },
    { name: 'created_at', label: 'Data de criação', type: 'Data/hora', required: true, isSystem: true },
    { name: 'updated_at', label: 'Última modificação', type: 'Data/hora', required: true, isSystem: true },
  ],
  deals: [
    { name: 'name', label: 'Nome do Negócio', type: 'Texto', required: true, isSystem: true },
    { name: 'value', label: 'Valor', type: 'Moeda', required: false, default: '0', isSystem: true },
    { name: 'stage', label: 'Etapa do Funil', type: 'Dropdown', required: true, default: 'prospeccao', isSystem: true },
    { name: 'close_date', label: 'Data de Fechamento', type: 'Data', required: false, isSystem: true },
    { name: 'owner_id', label: 'Proprietário', type: 'Referência', required: true, isSystem: true },
    { name: 'created_at', label: 'Data de criação', type: 'Data/hora', required: true, isSystem: true },
    { name: 'updated_at', label: 'Última modificação', type: 'Data/hora', required: true, isSystem: true },
  ],
};

const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'email', label: 'E-mail' },
  { value: 'currency', label: 'Moeda' },
  { value: 'dropdown', label: 'Dropdown' },
];

export default function PropertiesSettings() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('companies');
  const [form, setForm] = useState({
    field_name: '',
    field_label: '',
    field_type: 'text',
    is_required: false,
    default_value: '',
    dropdown_options: '',
  });

  const { data: customProps = [] } = useQuery({
    queryKey: ['custom-properties'],
    queryFn: async () => {
      const { data, error } = await supabase.from('custom_properties').select('*').order('sort_order');
      if (error) throw error;
      return data as CustomProperty[];
    },
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const fieldName = form.field_name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!fieldName) { toast.error('Nome interno inválido'); return; }
    setSaving(true);
    const { error } = await supabase.from('custom_properties').insert({
      entity_type: activeTab,
      field_name: fieldName,
      field_label: form.field_label.trim(),
      field_type: form.field_type,
      is_required: form.is_required,
      default_value: form.default_value || null,
      dropdown_options: form.field_type === 'dropdown' && form.dropdown_options
        ? form.dropdown_options.split(',').map((s) => s.trim()).filter(Boolean)
        : null,
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message.includes('unique') ? 'Campo já existe' : 'Erro: ' + error.message);
    } else {
      toast.success('Propriedade criada!');
      setOpen(false);
      setForm({ field_name: '', field_label: '', field_type: 'text', is_required: false, default_value: '', dropdown_options: '' });
      queryClient.invalidateQueries({ queryKey: ['custom-properties'] });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('custom_properties').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir');
    } else {
      toast.success('Propriedade excluída');
      queryClient.invalidateQueries({ queryKey: ['custom-properties'] });
    }
  };

  const entityCustomProps = customProps.filter((p) => p.entity_type === activeTab);
  const systemProps = SYSTEM_PROPS[activeTab] || [];

  const allProps: PropertyDef[] = [
    ...systemProps,
    ...entityCustomProps.map((p) => ({
      name: p.field_name,
      label: p.field_label,
      type: FIELD_TYPES.find((f) => f.value === p.field_type)?.label || p.field_type,
      required: p.is_required,
      default: p.default_value || undefined,
      isSystem: false,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Configurações de Propriedades</h1>
            <p className="text-sm text-muted-foreground">Gerencie campos padrão e customizados</p>
          </div>
        </div>
        {role === 'admin' && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Propriedade</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar Propriedade Customizada</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Entidade</Label>
                  <Select value={activeTab} onValueChange={setActiveTab}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="companies">Empresas</SelectItem>
                      <SelectItem value="contacts">Contatos</SelectItem>
                      <SelectItem value="deals">Negócios</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nome do campo (label)</Label>
                  <Input value={form.field_label} onChange={(e) => setForm({ ...form, field_label: e.target.value, field_name: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') })} placeholder="Ex: CNPJ" required maxLength={50} />
                  <p className="text-[10px] text-muted-foreground">Nome interno: <code>{form.field_name || '...'}</code></p>
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.field_type} onValueChange={(v) => setForm({ ...form, field_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {form.field_type === 'dropdown' && (
                  <div className="space-y-2">
                    <Label>Opções (separadas por vírgula)</Label>
                    <Input value={form.dropdown_options} onChange={(e) => setForm({ ...form, dropdown_options: e.target.value })} placeholder="Opção 1, Opção 2, Opção 3" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Valor padrão</Label>
                  <Input value={form.default_value} onChange={(e) => setForm({ ...form, default_value: e.target.value })} placeholder="Opcional" />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_required} onCheckedChange={(v) => setForm({ ...form, is_required: v })} />
                  <Label>Obrigatório</Label>
                </div>
                <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Criando...' : 'Criar Propriedade'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="companies" className="gap-1.5"><Building2 className="h-4 w-4" />Empresas</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1.5"><Users className="h-4 w-4" />Contatos</TabsTrigger>
          <TabsTrigger value="deals" className="gap-1.5"><Briefcase className="h-4 w-4" />Negócios</TabsTrigger>
        </TabsList>

        {['companies', 'contacts', 'deals'].map((entity) => (
          <TabsContent key={entity} value={entity} className="mt-4">
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
                      <TableHead>Origem</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allProps.map((p) => (
                      <TableRow key={p.name}>
                        <TableCell className="font-medium text-foreground">{p.label}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">{p.name}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{p.type}</Badge></TableCell>
                        <TableCell>
                          {p.required ? <Badge className="bg-primary/10 text-primary text-xs">Sim</Badge> : <span className="text-muted-foreground text-xs">Não</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{p.default || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${p.isSystem ? 'border-muted-foreground/30' : 'border-accent text-accent'}`}>
                            {p.isSystem ? 'Sistema' : 'Custom'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {!p.isSystem && role === 'admin' && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                              const cp = entityCustomProps.find((c) => c.field_name === p.name);
                              if (cp) handleDelete(cp.id);
                            }}>
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
