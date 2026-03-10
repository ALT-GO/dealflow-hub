import { useState } from 'react';
import { TasksChecklist } from '@/components/TasksChecklist';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { DynamicFields } from '@/components/DynamicFields';
import { InlineEdit } from '@/components/InlineEdit';
import { useCustomProperties, useCustomPropertyValues } from '@/hooks/useCustomProperties';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
  ArrowLeft, Mail, Building2, Briefcase, StickyNote, Activity, ListTodo,
  User, Clock, Layers,
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

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [noteContent, setNoteContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'meeting', title: '', description: '' });
  const [activitySaving, setActivitySaving] = useState(false);

  const { data: customProps = [] } = useCustomProperties('contacts');
  const { data: customValues = {} } = useCustomPropertyValues(id);

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
    queryClient.invalidateQueries({ queryKey: ['contact', id] });
    queryClient.invalidateQueries({ queryKey: ['contact-notes', id] });
    queryClient.invalidateQueries({ queryKey: ['contact-activities', id] });
  };

  /** Inline edit a system property */
  const handleInlineEdit = async (field: string, label: string, oldValue: string, newValue: string) => {
    if (!user || !id || newValue === oldValue) return;
    const { error } = await supabase.from('contacts').update({ [field]: newValue || null }).eq('id', id);
    if (error) { toast.error('Erro ao salvar'); return; }
    // Log change to timeline
    await supabase.from('activities').insert({
      type: 'property_changed',
      title: `Alterou "${label}"`,
      description: `De "${oldValue || '(vazio)'}" para "${newValue || '(vazio)'}"`,
      contact_id: id,
      company_id: contact?.company_id || null,
      created_by: user.id,
    });
    invalidateAll();
    toast.success('Atualizado!');
  };

  const handleAddNote = async () => {
    if (!noteContent.trim() || !user || !id) return;
    setSaving(true);
    const { error } = await supabase.from('contact_notes').insert({ contact_id: id, content: noteContent.trim(), created_by: user.id });
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
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/contacts')}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">{contact.name}</h1>
          <p className="text-xs text-muted-foreground">Contato{company ? ` · ${company.name}` : ''}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-4">
        {/* LEFT: Properties in Accordion Sections */}
        <div className="space-y-3">
          <Accordion type="multiple" defaultValue={['basic', 'sales', 'custom']}>
            <AccordionItem value="basic" className="border-border">
              <Card className="border-0 shadow-none">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Informações Básicas</span>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="space-y-3 text-sm pt-0 px-4 pb-4">
                    <div>
                      <p className="text-muted-foreground text-xs">Nome</p>
                      <InlineEdit value={contact.name} onSave={(v) => handleInlineEdit('name', 'Nome', contact.name, v)} icon={<User className="h-3 w-3 shrink-0 text-muted-foreground" />} />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">E-mail</p>
                      <InlineEdit value={contact.email || ''} onSave={(v) => handleInlineEdit('email', 'E-mail', contact.email || '', v)} icon={<Mail className="h-3 w-3 shrink-0 text-muted-foreground" />} />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Cargo</p>
                      <InlineEdit value={contact.role || ''} onSave={(v) => handleInlineEdit('role', 'Cargo', contact.role || '', v)} />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Empresa</p>
                      <p className="font-medium text-foreground flex items-center gap-1 cursor-pointer hover:text-primary transition-colors" onClick={() => company && navigate(`/companies/${company.id}`)}>
                        <Building2 className="h-3 w-3" />{company?.name || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Criado em</p>
                      <p className="font-medium text-foreground text-sm">{new Date(contact.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            <AccordionItem value="sales" className="border-border">
              <Card className="border-0 shadow-none">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detalhes da Venda</span>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="space-y-3 text-sm pt-0 px-4 pb-4">
                    <div>
                      <p className="text-muted-foreground text-xs">Status</p>
                      <InlineEdit value={contact.status || ''} onSave={(v) => handleInlineEdit('status', 'Status', contact.status || '', v)} />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Origem do Lead</p>
                      <InlineEdit value={contact.lead_source || ''} onSave={(v) => handleInlineEdit('lead_source', 'Origem do Lead', contact.lead_source || '', v)} />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Negócios Vinculados</p>
                      <p className="font-medium text-foreground">{deals.length}</p>
                    </div>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            {customProps.length > 0 && (
              <AccordionItem value="custom" className="border-border">
                <Card className="border-0 shadow-none">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Layers className="h-3 w-3" />Campos Customizados
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="pt-0 px-4 pb-4">
                      <DynamicFields properties={customProps} values={customValues} onChange={() => {}} readOnly />
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            )}
          </Accordion>
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
                        <p className="text-xs text-muted-foreground mt-3 border-t border-border pt-2">{new Date(n.created_at).toLocaleString('pt-BR')}</p>
                      </CardContent>
                    </Card>
                  ))}
                  {notes.length === 0 && <p className="text-center text-muted-foreground py-6 text-xs">Nenhuma nota</p>}
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
                <div className="p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors duration-200" onClick={() => navigate(`/companies/${company.id}`)}>
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
          <TasksChecklist contactId={id} />
        </div>
      </div>
    </div>
  );
}
