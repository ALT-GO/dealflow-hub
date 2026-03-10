import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Search, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AdvancedFilters, type Filters } from '@/components/AdvancedFilters';
import { ViewTabs, type ViewTab } from '@/components/ViewTabs';
import { useCustomProperties } from '@/hooks/useCustomProperties';
import { DynamicFields, saveCustomPropertyValues } from '@/components/DynamicFields';

const LEAD_SOURCES = ['Site', 'Indicação', 'Evento', 'Outbound', 'Inbound', 'Parceiro', 'Outro'];
const CONTACT_STATUSES = [
  { value: 'novo', label: 'Novo', color: 'bg-primary/10 text-primary' },
  { value: 'ativo', label: 'Ativo', color: 'bg-success/10 text-success' },
  { value: 'inativo', label: 'Inativo', color: 'bg-muted text-muted-foreground' },
  { value: 'qualificado', label: 'Qualificado', color: 'bg-accent/10 text-accent' },
];

type Contact = {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  lead_source: string | null;
  status: string | null;
  company_id: string;
  companies: { name: string } | null;
};

export default function Contacts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [companiesList, setCompaniesList] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ name: '', email: '', role: '', company_id: '', lead_source: '', status: 'novo' });
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>({});
  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const { data: customProps = [] } = useCustomProperties('contacts');

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', search, filters],
    queryFn: async () => {
      let q = supabase.from('contacts').select('id, name, email, role, lead_source, status, company_id, companies(name)').order('name');
      if (search) q = q.ilike('name', `%${search}%`);
      if (filters.createdAfter) q = q.gte('created_at', filters.createdAfter);
      if (filters.createdBefore) q = q.lte('created_at', filters.createdBefore + 'T23:59:59');
      if (filters.ownerId === 'mine' && user) q = q.eq('created_by', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Contact[];
    },
  });

  useEffect(() => {
    if (open) {
      supabase.from('companies').select('id, name').order('name').then(({ data }) => {
        if (data) setCompaniesList(data);
      });
    }
  }, [open]);

  const handleTabChange = (tab: ViewTab, tabFilters?: Filters) => {
    setActiveTab(tab);
    if (tabFilters) setFilters(tabFilters);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.from('contacts').insert({
      name: form.name,
      email: form.email || null,
      role: form.role || null,
      company_id: form.company_id,
      lead_source: form.lead_source || null,
      status: form.status || 'novo',
      created_by: user.id,
    }).select('id').single();
    if (error) {
      toast.error('Erro: ' + error.message);
      setLoading(false);
      return;
    }
    if (data && Object.keys(customValues).length > 0) {
      await saveCustomPropertyValues(data.id, customValues, supabase);
    }
    setLoading(false);
    toast.success('Contato criado!');
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
    setOpen(false);
    setForm({ name: '', email: '', role: '', company_id: '', lead_source: '', status: 'novo' });
    setCustomValues({});
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Contatos</h1>
          <p className="text-muted-foreground text-sm">{contacts.length} contatos cadastrados</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Contato</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo Contato</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <Input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">E-mail</Label>
                <Input type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cargo</Label>
                <Input placeholder="Cargo" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Empresa</Label>
                <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                  <SelectContent>
                    {companiesList.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Origem do Lead</Label>
                <Select value={form.lead_source} onValueChange={(v) => setForm({ ...form, lead_source: v })}>
                  <SelectTrigger><SelectValue placeholder="Origem do Lead" /></SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    {CONTACT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {customProps.length > 0 && (
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Campos Customizados</p>
                  <DynamicFields properties={customProps} values={customValues} onChange={setCustomValues} />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading || !form.company_id}>{loading ? 'Criando...' : 'Criar Contato'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ViewTabs entityType="contacts" activeTab={activeTab} onTabChange={handleTabChange} currentFilters={filters} />

      <AdvancedFilters
        entityType="contacts"
        filters={filters}
        onFiltersChange={setFilters}
        activeViewId={activeTab !== 'all' && activeTab !== 'mine' && activeTab !== 'recent' ? activeTab : undefined}
        onViewSelect={(v) => setActiveTab(v?.id || 'all')}
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar contatos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => {
                const statusDef = CONTACT_STATUSES.find((s) => s.value === c.status);
                return (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/contacts/${c.id}`)}>
                    <TableCell className="font-medium text-primary">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{c.role || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{c.companies?.name || '-'}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{c.lead_source || '-'}</TableCell>
                    <TableCell>
                      {statusDef ? (
                        <Badge variant="secondary" className={`text-[10px] ${statusDef.color}`}>{statusDef.label}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {contacts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum contato encontrado</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
