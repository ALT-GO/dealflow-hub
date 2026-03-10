import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Search, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AdvancedFilters, type Filters } from '@/components/AdvancedFilters';
import { ViewTabs, type ViewTab } from '@/components/ViewTabs';
import { useCustomProperties } from '@/hooks/useCustomProperties';
import { DynamicFields, saveCustomPropertyValues } from '@/components/DynamicFields';

export default function Companies() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', domain: '', sector: '', phone: '' });
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>({});
  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const { data: customProps = [] } = useCustomProperties('companies');
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ id: '', name: '', domain: '', sector: '', phone: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: companies = [] } = useQuery({
    queryKey: ['companies', search, filters],
    queryFn: async () => {
      let q = supabase.from('companies').select('*').order('name');
      if (search) q = q.ilike('name', `%${search}%`);
      if (filters.createdAfter) q = q.gte('created_at', filters.createdAfter);
      if (filters.createdBefore) q = q.lte('created_at', filters.createdBefore + 'T23:59:59');
      if (filters.ownerId === 'mine' && user) q = q.eq('created_by', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const handleTabChange = (tab: ViewTab, tabFilters?: Filters) => {
    setActiveTab(tab);
    if (tabFilters) setFilters(tabFilters);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.from('companies').insert({ ...form, created_by: user.id }).select('id').single();
    if (error) {
      toast.error('Erro: ' + error.message);
      setLoading(false);
      return;
    }
    if (data && Object.keys(customValues).length > 0) {
      await saveCustomPropertyValues(data.id, customValues, supabase);
    }
    setLoading(false);
    toast.success('Empresa criada!');
    queryClient.invalidateQueries({ queryKey: ['companies'] });
    setOpen(false);
    setForm({ name: '', domain: '', sector: '', phone: '' });
    setCustomValues({});
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    const { error } = await supabase.from('companies').update({
      name: editForm.name, domain: editForm.domain || null, sector: editForm.sector || null, phone: editForm.phone || null,
    }).eq('id', editForm.id);
    setEditLoading(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Empresa atualizada!');
    queryClient.invalidateQueries({ queryKey: ['companies'] });
    setEditOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('companies').delete().eq('id', deleteId);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Empresa excluída!');
    queryClient.invalidateQueries({ queryKey: ['companies'] });
    setDeleteId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Empresas</h1>
          <p className="text-muted-foreground text-sm">{companies.length} empresas cadastradas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nova Empresa</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova Empresa</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <Input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Domínio</Label>
                <Input placeholder="empresa.com" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Setor</Label>
                <Input placeholder="Setor" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Telefone</Label>
                <Input placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>

              {customProps.length > 0 && (
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Campos Customizados</p>
                  <DynamicFields properties={customProps} values={customValues} onChange={setCustomValues} />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Criando...' : 'Criar Empresa'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ViewTabs entityType="companies" activeTab={activeTab} onTabChange={handleTabChange} currentFilters={filters} />

      <AdvancedFilters
        entityType="companies"
        filters={filters}
        onFiltersChange={setFilters}
        activeViewId={activeTab !== 'all' && activeTab !== 'mine' && activeTab !== 'recent' ? activeTab : undefined}
        onViewSelect={(v) => setActiveTab(v?.id || 'all')}
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar empresas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Domínio</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50 group" onClick={() => navigate(`/companies/${c.id}`)}>
                  <TableCell className="font-medium text-primary">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.domain || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.sector || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone || '-'}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditForm({ id: c.id, name: c.name, domain: c.domain || '', sector: c.sector || '', phone: c.phone || '' }); setEditOpen(true); }}>
                          <Pencil className="h-4 w-4 mr-2" />Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="h-4 w-4 mr-2" />Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {companies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma empresa encontrada</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Empresa</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Domínio</Label>
              <Input value={editForm.domain} onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Setor</Label>
              <Input value={editForm.sector} onChange={(e) => setEditForm({ ...editForm, sector: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Telefone</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <Button type="submit" className="w-full" disabled={editLoading}>{editLoading ? 'Salvando...' : 'Salvar'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é irreversível. Todos os dados relacionados serão perdidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
