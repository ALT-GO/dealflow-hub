import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Search } from 'lucide-react';

export default function Companies() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', domain: '', sector: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const { data: companies = [] } = useQuery({
    queryKey: ['companies', search],
    queryFn: async () => {
      let q = supabase.from('companies').select('*').order('name');
      if (search) q = q.ilike('name', `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from('companies').insert({ ...form, created_by: user.id });
    setLoading(false);
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success('Empresa criada!');
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setOpen(false);
      setForm({ name: '', domain: '', sector: '', phone: '' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Empresas</h1>
          <p className="text-muted-foreground text-sm">{companies.length} empresas cadastradas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nova Empresa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Empresa</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input placeholder="Domínio (ex: empresa.com)" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
              <Input placeholder="Setor" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} />
              <Input placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Criando...' : 'Criar Empresa'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar empresas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.domain || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.sector || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone || '-'}</TableCell>
                </TableRow>
              ))}
              {companies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhuma empresa encontrada
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
