import { useState } from 'react';
import { TasksChecklist } from '@/components/TasksChecklist';
import { useParams, useNavigate } from 'react-router-dom';
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
  ArrowLeft, Mail, Phone, Building2, Briefcase, StickyNote, Activity, ListTodo,
  PhoneCall, CalendarClock, ChevronDown, ChevronUp, DollarSign, User,
} from 'lucide-react';

const stageLabels: Record<string, string> = {
  prospeccao: 'Prospecção', qualificacao: 'Qualificação', proposta: 'Proposta',
  negociacao: 'Negociação', fechado: 'Fechado',
};
const stageColors: Record<string, string> = {
  prospeccao: 'bg-muted text-muted-foreground', qualificacao: 'bg-primary/10 text-primary',
  proposta: 'bg-accent/10 text-accent', negociacao: 'bg-warning/10 text-warning',
  fechado: 'bg-success/10 text-success',
};

const activityIcons: Record<string, typeof PhoneCall> = {
  meeting: CalendarClock,
  call: PhoneCall,
  note: StickyNote,
};

export default function ContactDetail() {
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

  const { data: contact } = useQuery({
    queryKey: ['contact', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('contacts').select('*, companies(id, name, domain, sector)').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['contact-deals', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('deals').select('*').eq('contact_id', id!).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['contact-notes', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('contact_notes').select('*').eq('contact_id', id!).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['contact-activities', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('activities').select('*').eq('contact_id', id!).order('activity_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const handleAddNote = async () => {
    if (!noteContent.trim() || !user || !id) return;
    setSaving(true);
    const { error } = await supabase.from('contact_notes').insert({ contact_id: id, content: noteContent.trim(), created_by: user.id });
    setSaving(false);
    if (error) { toast.error('Erro ao salvar nota'); return; }
    toast.success('Nota adicionada!');
    setNoteContent('');
    queryClient.invalidateQueries({ queryKey: ['contact-notes', id] });
  };

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    setActivitySaving(true);
    const { error } = await supabase.from('activities').insert({
      type: activityForm.type,
      title: activityForm.title.trim(),
      description: activityForm.description.trim() || null,
      contact_id: id,
      company_id: contact?.company_id || null,
      created_by: user.id,
    });
    setActivitySaving(false);
    if (error) { toast.error('Erro ao registrar atividade'); return; }
    toast.success('Atividade registrada!');
    setActivityForm({ type: 'meeting', title: '', description: '' });
    setActivityOpen(false);
    queryClient.invalidateQueries({ queryKey: ['contact-activities', id] });
  };

  if (!contact) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const company = contact.companies as { id: string; name: string; domain: string | null; sector: string | null } | null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/contacts')}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">{contact.name}</h1>
          <p className="text-xs text-muted-foreground">Contato{company ? ` · ${company.name}` : ''}</p>
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
                <p className="font-medium text-foreground flex items-center gap-1"><User className="h-3 w-3" />{contact.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">E-mail</p>
                <p className="font-medium text-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{contact.email || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Cargo</p>
                <p className="font-medium text-foreground">{contact.role || '-'}</p>
              </div>
              {showAllProps && (
                <>
                  <div>
                    <p className="text-muted-foreground text-xs">Empresa</p>
                    <p className="font-medium text-foreground flex items-center gap-1"><Building2 className="h-3 w-3" />{company?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Criado em</p>
                    <p className="font-medium text-foreground">{new Date(contact.created_at).toLocaleDateString('pt-BR')}</p>
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
            <h2 className="text-sm font-semibold text-foreground">Atividades</h2>
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
                    <Input value={activityForm.title} onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })} placeholder="Ex: Call de follow-up" required maxLength={100} />
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

          <Tabs defaultValue="notes">
            <TabsList>
              <TabsTrigger value="notes" className="text-xs gap-1.5"><StickyNote className="h-3.5 w-3.5" />Notas</TabsTrigger>
              <TabsTrigger value="activities" className="text-xs gap-1.5"><Activity className="h-3.5 w-3.5" />Atividades</TabsTrigger>
              <TabsTrigger value="tasks" className="text-xs gap-1.5"><ListTodo className="h-3.5 w-3.5" />Tarefas</TabsTrigger>
            </TabsList>

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

            <TabsContent value="activities" className="mt-3">
              <ScrollArea className="max-h-[500px]">
                <div className="space-y-3">
                  {activities.map((a) => {
                    const Icon = activityIcons[a.type] || Activity;
                    return (
                      <div key={a.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="w-px flex-1 bg-border mt-1" />
                        </div>
                        <Card className="flex-1 border-border">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm text-foreground">{a.title}</p>
                              <Badge variant="secondary" className="text-[10px]">{a.type === 'meeting' ? 'Reunião' : a.type === 'call' ? 'Chamada' : 'Nota'}</Badge>
                            </div>
                            {a.description && <p className="text-xs text-muted-foreground mt-1">{a.description}</p>}
                            <p className="text-[10px] text-muted-foreground mt-2">{new Date(a.activity_date).toLocaleString('pt-BR')}</p>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                  {activities.length === 0 && <p className="text-center text-muted-foreground py-6 text-xs">Nenhuma atividade registrada</p>}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="tasks" className="mt-3">
              <TasksChecklist contactId={id} />
            </TabsContent>
          </Tabs>
        </div>

        {/* RIGHT: Associations */}
        <div className="space-y-4">
          {company && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5"><Building2 className="h-4 w-4" />Empresa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-2 rounded-md hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/companies/${company.id}`)}>
                  <p className="text-sm font-medium text-primary">{company.name}</p>
                  <p className="text-xs text-muted-foreground">{company.sector || company.domain || '-'}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5"><Briefcase className="h-4 w-4" />Negócios ({deals.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {deals.slice(0, 5).map((d) => (
                <div key={d.id} className="p-2 rounded-md hover:bg-muted/50">
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
          <TasksChecklist contactId={id} />
        </div>
      </div>
    </div>
  );
}
