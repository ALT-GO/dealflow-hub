import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, Users, Briefcase, StickyNote, Globe, Phone, Building2 } from 'lucide-react';

const stageLabels: Record<string, string> = {
  prospeccao: 'Prospecção',
  qualificacao: 'Qualificação',
  proposta: 'Proposta',
  negociacao: 'Negociação',
  fechado: 'Fechado',
};

const stageColors: Record<string, string> = {
  prospeccao: 'bg-muted text-muted-foreground',
  qualificacao: 'bg-primary/10 text-primary',
  proposta: 'bg-accent/10 text-accent',
  negociacao: 'bg-warning/10 text-warning',
  fechado: 'bg-success/10 text-success',
};

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [noteContent, setNoteContent] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: company } = useQuery({
    queryKey: ['company', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['company-contacts', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('contacts').select('*').eq('company_id', id!).order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['company-deals', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('deals').select('*').eq('company_id', id!).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['company-notes', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_notes').select('*').eq('company_id', id!).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const handleAddNote = async () => {
    if (!noteContent.trim() || !user || !id) return;
    setSaving(true);
    const { error } = await supabase.from('company_notes').insert({
      company_id: id,
      content: noteContent.trim(),
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar nota');
    } else {
      toast.success('Nota adicionada!');
      setNoteContent('');
      queryClient.invalidateQueries({ queryKey: ['company-notes', id] });
    }
  };

  if (!company) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const totalPipeline = deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/companies')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold text-foreground">{company.name}</h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            {company.sector && (
              <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{company.sector}</span>
            )}
            {company.domain && (
              <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" />{company.domain}</span>
            )}
            {company.phone && (
              <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{company.phone}</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Pipeline Total</p>
          <p className="text-xl font-display font-bold text-foreground">
            {totalPipeline.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="contacts" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="contacts" className="gap-2">
            <Users className="h-4 w-4" />Contatos ({contacts.length})
          </TabsTrigger>
          <TabsTrigger value="deals" className="gap-2">
            <Briefcase className="h-4 w-4" />Negócios ({deals.length})
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-2">
            <StickyNote className="h-4 w-4" />Notas ({notes.length})
          </TabsTrigger>
        </TabsList>

        {/* Contatos */}
        <TabsContent value="contacts">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Cargo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.email || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{c.role || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {contacts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        Nenhum contato vinculado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Negócios */}
        <TabsContent value="deals">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Data de Fechamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deals.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {(Number(d.value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={stageColors[d.stage] || ''}>
                          {stageLabels[d.stage] || d.stage}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {d.close_date ? new Date(d.close_date).toLocaleDateString('pt-BR') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {deals.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum negócio vinculado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notas */}
        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nova Nota</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Escreva uma anotação rápida..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={3}
              />
              <Button onClick={handleAddNote} disabled={saving || !noteContent.trim()} size="sm">
                {saving ? 'Salvando...' : 'Adicionar Nota'}
              </Button>
            </CardContent>
          </Card>
          <div className="mt-4 space-y-3">
            {notes.map((n) => (
              <Card key={n.id}>
                <CardContent className="py-4 px-5">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{n.content}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(n.created_at).toLocaleString('pt-BR')}
                  </p>
                </CardContent>
              </Card>
            ))}
            {notes.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma nota ainda</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
