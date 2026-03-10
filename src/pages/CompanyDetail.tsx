import { useState } from 'react';
import { TasksChecklist } from '@/components/TasksChecklist';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  ArrowLeft, Building2, Globe, Phone, StickyNote, Activity, ListTodo,
  PhoneCall, CalendarClock, ChevronDown, ChevronUp, Users, Briefcase, DollarSign, Clock,
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';

const stageLabels: Record<string, string> = {
  prospeccao: 'Prospecção', qualificacao: 'Qualificação', proposta: 'Proposta',
  negociacao: 'Negociação', fechado: 'Fechado',
};
const stageColors: Record<string, string> = {
  prospeccao: 'bg-muted text-muted-foreground', qualificacao: 'bg-primary/10 text-primary',
  proposta: 'bg-accent/10 text-accent', negociacao: 'bg-warning/10 text-warning',
  fechado: 'bg-success/10 text-success',
};

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [noteContent, setNoteContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAllProps, setShowAllProps] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'meeting', title: '', description: '' });
  const [activitySaving, setActivitySaving] = useState(false);

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

  const { data: activities = [] } = useQuery({
    queryKey: ['company-activities', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('activities').select('*').eq('company_id', id!).order('activity_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch profile names for activity authors
  const { data: profilesMap = {} } = useQuery({
    queryKey: ['profiles-map'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      const map: Record<string, string> = {};
      (data || []).forEach((p) => { if (p.full_name) map[p.user_id] = p.full_name; });
      return map;
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['company-notes', id] });
    queryClient.invalidateQueries({ queryKey: ['company-activities', id] });
  };

  const handleAddNote = async () => {
    if (!noteContent.trim() || !user || !id) return;
    setSaving(true);
    const { error } = await supabase.from('company_notes').insert({ company_id: id, content: noteContent.trim(), created_by: user.id });
    setSaving(false);
    if (error) { toast.error('Erro ao salvar nota'); return; }
    toast.success('Nota adicionada!');
    setNoteContent('');
    invalidateAll();
  };

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    setActivitySaving(true);
    const { error } = await supabase.from('activities').insert({
      type: activityForm.type,
      title: activityForm.title.trim(),
      description: activityForm.description.trim() || null,
      company_id: id,
      created_by: user.id,
    });
    setActivitySaving(false);
    if (error) { toast.error('Erro ao registrar atividade'); return; }
    toast.success('Atividade registrada!');
    setActivityForm({ type: 'meeting', title: '', description: '' });
    setActivityOpen(false);
    queryClient.invalidateQueries({ queryKey: ['company-activities', id] });
  };

  if (!company) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const totalPipeline = deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/companies')}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">{company.name}</h1>
          <p className="text-xs text-muted-foreground">Empresa</p>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-4">
        {/* LEFT: Properties */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Nome</p>
                <p className="font-medium text-foreground">{company.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Domínio</p>
                <p className="font-medium text-foreground flex items-center gap-1"><Globe className="h-3 w-3" />{company.domain || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Telefone</p>
                <p className="font-medium text-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{company.phone || '-'}</p>
              </div>
              {showAllProps && (
                <>
                  <div>
                    <p className="text-muted-foreground text-xs">Setor</p>
                    <p className="font-medium text-foreground flex items-center gap-1"><Building2 className="h-3 w-3" />{company.sector || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Pipeline Total</p>
                    <p className="font-medium text-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {totalPipeline.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Criado em</p>
                    <p className="font-medium text-foreground">{new Date(company.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                </>
              )}
              <Button variant="ghost" size="sm" className="w-full text-xs text-primary" onClick={() => setShowAllProps(!showAllProps)}>
                {showAllProps ? <><ChevronUp className="h-3 w-3 mr-1" />Menos propriedades</> : <><ChevronDown className="h-3 w-3 mr-1" />Visualizar todas as propriedades</>}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* CENTER: Timeline */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" />Histórico
            </h2>
            <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-xs"><Activity className="h-3.5 w-3.5 mr-1" />Log de Atividade</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Registrar Atividade</DialogTitle></DialogHeader>
                <form onSubmit={handleLogActivity} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={activityForm.type} onValueChange={(v) => setActivityForm({ ...activityForm, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="meeting">Reunião</SelectItem>
                        <SelectItem value="call">Chamada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input value={activityForm.title} onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })} placeholder="Ex: Reunião de discovery" required maxLength={100} />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea value={activityForm.description} onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })} placeholder="Detalhes..." rows={3} maxLength={1000} />
                  </div>
                  <Button type="submit" className="w-full" disabled={activitySaving}>{activitySaving ? 'Salvando...' : 'Registrar'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline" className="text-xs gap-1.5"><Clock className="h-3.5 w-3.5" />Timeline</TabsTrigger>
              <TabsTrigger value="notes" className="text-xs gap-1.5"><StickyNote className="h-3.5 w-3.5" />Notas</TabsTrigger>
              <TabsTrigger value="tasks" className="text-xs gap-1.5"><ListTodo className="h-3.5 w-3.5" />Tarefas</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="mt-3">
              <ActivityTimeline activities={activities} profiles={profilesMap} />
            </TabsContent>

            <TabsContent value="notes" className="space-y-3 mt-3">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <Textarea placeholder="Escreva uma anotação..." value={noteContent} onChange={(e) => setNoteContent(e.target.value)} rows={4} className="resize-none" />
                  <div className="flex justify-end">
                    <Button onClick={handleAddNote} disabled={saving || !noteContent.trim()} size="sm">{saving ? 'Salvando...' : 'Salvar Nota'}</Button>
                  </div>
                </CardContent>
              </Card>
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2">
                  {notes.map((n) => (
                    <Card key={n.id} className="border-border">
                      <CardContent className="p-4">
                        <div className="prose prose-sm max-w-none text-foreground text-sm whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: n.content }} />
                        <p className="text-xs text-muted-foreground mt-3 border-t border-border pt-2">
                          {new Date(n.created_at).toLocaleString('pt-BR')}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                  {notes.length === 0 && <p className="text-center text-muted-foreground py-6 text-xs">Nenhuma nota</p>}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="tasks" className="mt-3">
              <TasksChecklist dealId={deals[0]?.id} contactId={contacts[0]?.id} />
            </TabsContent>
          </Tabs>
        </div>

        {/* RIGHT: Associations */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5"><Users className="h-4 w-4" />Contatos ({contacts.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {contacts.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors duration-200" onClick={() => navigate(`/contacts/${c.id}`)}>
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.role || c.email || '-'}</p>
                  </div>
                </div>
              ))}
              {contacts.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum contato</p>}
              {contacts.length > 5 && <Button variant="ghost" size="sm" className="w-full text-xs text-primary">Ver todos ({contacts.length})</Button>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5"><Briefcase className="h-4 w-4" />Negócios ({deals.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {deals.slice(0, 5).map((d) => (
                <div key={d.id} className="p-2 rounded-lg hover:bg-muted/50 transition-colors duration-200">
                  <p className="text-sm font-medium text-foreground">{d.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className={`text-[10px] ${stageColors[d.stage] || ''}`}>{stageLabels[d.stage] || d.stage}</Badge>
                    <span className="text-xs text-muted-foreground">{(Number(d.value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                </div>
              ))}
              {deals.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum negócio</p>}
            </CardContent>
          </Card>
          <TasksChecklist contactId={contacts[0]?.id} />
        </div>
      </div>
    </div>
  );
}
