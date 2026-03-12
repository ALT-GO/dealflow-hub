import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
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
import { Building2, Users, Briefcase, Plus, Trash2, Search } from 'lucide-react';

type PropertyDef = {
  name: string;
  label: string;
  type: string;
  required: boolean;
  default?: string;
  isSystem: boolean;
  displaySection?: string;
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
  display_section: string;
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

const DISPLAY_SECTIONS = [
  'Informações do Negócio',
  'Dados de Orçamentos',
  'Dados Técnicos',
  'Resumo',
];

const ENTITY_LABELS: Record<string, string> = {
  companies: 'Empresas',
  contacts: 'Contatos',
  deals: 'Negócios',
};

export function ObjectsTab() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeEntity, setActiveEntity] = useState('companies');
  const [searchQuery, setSearchQuery] = useState('');
  const [originFilter, setOriginFilter] = useState<'all' | 'system' | 'custom'>('all');
  const [form, setForm] = useState({
    field_name: '',
    field_label: '',
    field_type: 'text',
    is_required: false,
    default_value: '',
    dropdown_options: '',
    display_section: 'Informações do Negócio',
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
      entity_type: activeEntity,
      field_name: fieldName,
      field_label: form.field_label.trim(),
      field_type: form.field_type,
      is_required: form.is_required,
      default_value: form.default_value || null,
      dropdown_options: form.field_type === 'dropdown' && form.dropdown_options
        ? form.dropdown_options.split(',').map((s) => s.trim()).filter(Boolean)
        : null,
      display_section: activeEntity === 'deals' ? form.display_section : 'Informações do Negócio',
      created_by: user.id,
    } as any);
    setSaving(false);
    if (error) {
      toast.error(error.message.includes('unique') ? 'Campo já existe' : 'Erro: ' + error.message);
    } else {
      toast.success('Propriedade criada!');
      setOpen(false);
      setForm({ field_name: '', field_label: '', field_type: 'text', is_required: false, default_value: '', dropdown_options: '', display_section: 'Informações do Negócio' });
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

  const entityCustomProps = customProps.filter((p) => p.entity_type === activeEntity);
  const systemProps = SYSTEM_PROPS[activeEntity] || [];

  const allProps: PropertyDef[] = [
    ...systemProps,
    ...entityCustomProps.map((p) => ({
      name: p.field_name,
      label: p.field_label,
      type: FIELD_TYPES.find((f) => f.value === p.field_type)?.label || p.field_type,
      required: p.is_required,
      default: p.default_value || undefined,
      isSystem: false,
      displaySection: p.display_section,
    })),
  ];

  const filteredProps = allProps.filter((p) => {
    if (searchQuery && !p.label.toLowerCase().includes(searchQuery.toLowerCase()) && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (originFilter === 'system' && !p.isSystem) return false;
    if (originFilter === 'custom' && p.isSystem) return false;
    return true;
  });

  const customCount = allProps.filter(p => !p.isSystem).length;
  const systemCount = allProps.filter(p => p.isSystem).length;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <Tabs value={activeEntity} onValueChange={(v) => { setActiveEntity(v); setSearchQuery(''); setOriginFilter('all'); }}>
          <TabsList>
            <TabsTrigger value="companies" className="gap-1.5"><Building2 className="h-4 w-4" />Empresas</TabsTrigger>
            <TabsTrigger value="contacts" className="gap-1.5"><Users className="h-4 w-4" />Contatos</TabsTrigger>
            <TabsTrigger value="deals" className="gap-1.5"><Briefcase className="h-4 w-4" />Negócios</TabsTrigger>
          </TabsList>
        </Tabs>
        {role === 'admin' && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" />Nova Propriedade</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar Propriedade Customizada</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Entidade</Label>
                  <Select value={activeEntity} onValueChange={setActiveEntity}>
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
                  <p className="text-[10px] text-muted-foreground">Nome interno: <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{form.field_name || '...'}</code></p>
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
                {activeEntity === 'deals' && (
                  <div className="space-y-2">
                    <Label>Seção de Exibição</Label>
                    <Select value={form.display_section} onValueChange={(v) => setForm({ ...form, display_section: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DISPLAY_SECTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Buscar em ${ENTITY_LABELS[activeEntity]}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant={originFilter === 'all' ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setOriginFilter('all')}>
            Todos ({allProps.length})
          </Button>
          <Button variant={originFilter === 'system' ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setOriginFilter('system')}>
            Sistema ({systemCount})
          </Button>
          <Button variant={originFilter === 'custom' ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setOriginFilter('custom')}>
            Custom ({customCount})
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campo</TableHead>
                <TableHead>Nome interno</TableHead>
                <TableHead>Tipo</TableHead>
                {activeEntity === 'deals' && <TableHead>Seção</TableHead>}
                <TableHead>Obrigatório</TableHead>
                <TableHead>Padrão</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProps.map((p) => (
                <TableRow key={p.name}>
                  <TableCell className="font-medium text-foreground">{p.label}</TableCell>
                  <TableCell><code className="text-muted-foreground bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{p.name}</code></TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs font-normal">{p.type}</Badge></TableCell>
                  {activeEntity === 'deals' && (
                    <TableCell>
                      {p.displaySection ? (
                        <Badge variant="outline" className="text-[10px]">{p.displaySection}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    {p.required ? (
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">Sim</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">Não</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{p.default || '-'}</TableCell>
                  <TableCell>
                    {p.isSystem ? (
                      <Badge variant="outline" className="text-[10px] border-muted-foreground/20 text-muted-foreground bg-muted/50">Sistema</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/5">Custom</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!p.isSystem && role === 'admin' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => {
                        const cp = entityCustomProps.find((c) => c.field_name === p.name);
                        if (cp) handleDelete(cp.id);
                      }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredProps.length === 0 && (
                <TableRow>
                  <TableCell colSpan={activeEntity === 'deals' ? 8 : 7} className="text-center text-muted-foreground py-8 text-sm">
                    Nenhuma propriedade encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
