import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building2, Users, Briefcase, Trash2, AlertTriangle } from 'lucide-react';
import { CsvImport } from '@/components/CsvImport';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export function ImportTab() {
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      // Delete in order: deals first (references companies/contacts), then contacts, then companies
      const { error: dealsErr } = await supabase.from('deals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (dealsErr) throw dealsErr;

      const { error: contactsErr } = await supabase.from('contacts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (contactsErr) throw contactsErr;

      const { error: companiesErr } = await supabase.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (companiesErr) throw companiesErr;

      queryClient.invalidateQueries();
      toast.success('Todos os registros foram excluídos com sucesso.');
    } catch (err: any) {
      toast.error('Erro ao excluir registros: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4 pt-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Importar Empresas</CardTitle>
              <CardDescription>Importe empresas a partir de um arquivo CSV ou TXT</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CsvImport entityType="companies" onComplete={() => {}} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Importar Contatos</CardTitle>
              <CardDescription>Importe contatos vinculados a empresas existentes</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CsvImport entityType="contacts" onComplete={() => {}} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Briefcase className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Importar Negócios</CardTitle>
              <CardDescription>Importe negócios vinculados a empresas existentes</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CsvImport entityType="deals" onComplete={() => {}} />
        </CardContent>
      </Card>

      {/* Delete All Section */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-destructive" />
            <div>
              <CardTitle className="text-base text-destructive">Zona de Perigo</CardTitle>
              <CardDescription>Exclua todos os negócios, contatos e empresas do sistema</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting} className="gap-2">
                <Trash2 className="h-4 w-4" />
                {deleting ? 'Excluindo...' : 'Excluir Todos os Registros'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Tem certeza absoluta?
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    Esta ação é <strong>irreversível</strong>. Todos os seguintes dados serão excluídos permanentemente:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Todos os <strong>negócios</strong> e seus dados relacionados</li>
                    <li>Todos os <strong>contatos</strong></li>
                    <li>Todas as <strong>empresas</strong></li>
                  </ul>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAll}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Sim, excluir tudo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
