import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { storage } from '@/lib/storage';
import {
  FolderOpen, FolderPlus, Plus, Trash2, Download, Eye, LayoutGrid, List,
  FileText, FileImage, FileSpreadsheet, File, ArrowLeft, Pencil, Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/* ───── helpers ───── */
function fileIcon(type: string) {
  if (type.startsWith('image/')) return <FileImage className="h-10 w-10 text-primary" />;
  if (type.includes('pdf')) return <FileText className="h-10 w-10 text-destructive" />;
  if (type.includes('sheet') || type.includes('excel') || type.includes('csv'))
    return <FileSpreadsheet className="h-10 w-10 text-accent" />;
  return <File className="h-10 w-10 text-muted-foreground" />;
}
function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function FileLibrary() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const canManage = role === 'admin' || role === 'gerencia';

  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [folderModal, setFolderModal] = useState(false);
  const [editFolder, setEditFolder] = useState<{ id: string; name: string; description: string } | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderDesc, setFolderDesc] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  /* ───── queries ───── */
  const { data: folders = [] } = useQuery({
    queryKey: ['library-folders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('library_folders')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: files = [] } = useQuery({
    queryKey: ['library-files', activeFolderId],
    enabled: !!activeFolderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('library_files')
        .select('*, profiles:uploaded_by(full_name)')
        .eq('folder_id', activeFolderId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const activeFolder = folders.find((f: any) => f.id === activeFolderId);

  /* ───── folder mutations ───── */
  const saveFolderMut = useMutation({
    mutationFn: async () => {
      if (editFolder) {
        const { error } = await supabase
          .from('library_folders')
          .update({ name: folderName, description: folderDesc || null })
          .eq('id', editFolder.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('library_folders')
          .insert({ name: folderName, description: folderDesc || null, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library-folders'] });
      closeFolderModal();
      toast.success(editFolder ? 'Pasta atualizada' : 'Pasta criada');
    },
    onError: () => toast.error('Erro ao salvar pasta'),
  });

  const deleteFolderMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('library_folders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library-folders'] });
      setActiveFolderId(null);
      toast.success('Pasta excluída');
    },
  });

  /* ───── file mutations ───── */
  const uploadFiles = useCallback(async (fileList: FileList) => {
    if (!activeFolderId || !user) return;
    const promises = Array.from(fileList).map(async (file) => {
      const path = `library/${activeFolderId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await storage.upload(path, file);
      if (uploadErr) { toast.error(`Erro: ${file.name}`); return; }
      const { error } = await supabase.from('library_files').insert({
        folder_id: activeFolderId,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: path,
        uploaded_by: user.id,
      });
      if (error) toast.error(`Erro ao registrar ${file.name}`);
    });
    await Promise.all(promises);
    qc.invalidateQueries({ queryKey: ['library-files', activeFolderId] });
    toast.success('Upload concluído');
  }, [activeFolderId, user, qc]);

  const deleteFileMut = useMutation({
    mutationFn: async (file: any) => {
      await storage.remove([file.storage_path]);
      const { error } = await supabase.from('library_files').delete().eq('id', file.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library-files', activeFolderId] });
      toast.success('Arquivo excluído');
    },
  });

  /* ───── helpers ───── */
  const closeFolderModal = () => { setFolderModal(false); setEditFolder(null); setFolderName(''); setFolderDesc(''); };
  const openEditFolder = (f: any) => { setEditFolder(f); setFolderName(f.name); setFolderDesc(f.description || ''); setFolderModal(true); };
  const openNewFolder = () => { setEditFolder(null); setFolderName(''); setFolderDesc(''); setFolderModal(true); };

  const handleDownload = (file: any) => {
    const url = storage.getPublicUrl(file.storage_path);
    const a = document.createElement('a');
    a.href = url; a.download = file.file_name; a.target = '_blank'; a.click();
  };

  const handlePreview = (file: any) => {
    setPreviewUrl(storage.getPublicUrl(file.storage_path));
  };

  /* ───── render ───── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {activeFolderId && (
            <Button variant="ghost" size="icon" onClick={() => setActiveFolderId(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FolderOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              {activeFolder ? activeFolder.name : 'Biblioteca de Arquivos'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeFolder ? (activeFolder as any).description || 'Gerencie os arquivos desta pasta' : 'Pastas e documentos compartilhados'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeFolderId && (
            <>
              <Button variant="outline" size="icon" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
                {viewMode === 'grid' ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
              </Button>
              <label>
                <Button variant="default" size="sm" asChild>
                  <span className="cursor-pointer"><Upload className="h-4 w-4 mr-1" /> Enviar Arquivo</span>
                </Button>
                <input type="file" className="hidden" multiple onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
              </label>
            </>
          )}
          {!activeFolderId && canManage && (
            <Button size="sm" onClick={openNewFolder}>
              <FolderPlus className="h-4 w-4 mr-1" /> Nova Pasta
            </Button>
          )}
        </div>
      </div>

      {/* Folders grid */}
      {!activeFolderId && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {folders.map((f: any) => (
            <Card
              key={f.id}
              className="group cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => setActiveFolderId(f.id)}
            >
              <CardContent className="p-4 flex flex-col items-center gap-2 text-center relative">
                <FolderOpen className="h-12 w-12 text-primary/70" />
                <span className="text-sm font-medium text-foreground truncate w-full">{f.name}</span>
                {f.description && <span className="text-xs text-muted-foreground line-clamp-1">{f.description}</span>}
                {canManage && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditFolder(f)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir pasta?</AlertDialogTitle>
                          <AlertDialogDescription>Todos os arquivos dentro serão removidos permanentemente.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteFolderMut.mutate(f.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {folders.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <FolderOpen className="h-16 w-16 mx-auto mb-3 opacity-30" />
              <p>Nenhuma pasta criada ainda.</p>
            </div>
          )}
        </div>
      )}

      {/* Files inside folder */}
      {activeFolderId && viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {files.map((f: any) => (
            <Card key={f.id} className="group hover:border-primary/40 transition-colors">
              <CardContent className="p-4 flex flex-col items-center gap-2 text-center relative">
                {fileIcon(f.file_type)}
                <span className="text-xs font-medium text-foreground truncate w-full" title={f.file_name}>{f.file_name}</span>
                <span className="text-[10px] text-muted-foreground">{humanSize(f.file_size)}</span>
                <span className="text-[10px] text-muted-foreground">
                  {(f as any).profiles?.full_name || 'Desconhecido'} · {format(new Date(f.created_at), 'dd/MM/yy', { locale: ptBR })}
                </span>
                <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {f.file_type.startsWith('image/') || f.file_type.includes('pdf') ? (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePreview(f)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(f)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {(canManage || f.uploaded_by === user?.id) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir arquivo?</AlertDialogTitle>
                          <AlertDialogDescription>O arquivo será removido permanentemente.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteFileMut.mutate(f)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {files.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Upload className="h-16 w-16 mx-auto mb-3 opacity-30" />
              <p>Nenhum arquivo nesta pasta.</p>
            </div>
          )}
        </div>
      )}

      {activeFolderId && viewMode === 'list' && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium text-muted-foreground">Arquivo</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Tamanho</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Enviado por</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Data</th>
                <th className="p-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {files.map((f: any) => (
                <tr key={f.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3 flex items-center gap-2">
                    <span className="shrink-0">{fileIcon(f.file_type)}</span>
                    <span className="truncate">{f.file_name}</span>
                  </td>
                  <td className="p-3 text-muted-foreground hidden sm:table-cell">{humanSize(f.file_size)}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{(f as any).profiles?.full_name || '–'}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{format(new Date(f.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}</td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      {(f.file_type.startsWith('image/') || f.file_type.includes('pdf')) && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePreview(f)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(f)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      {(canManage || f.uploaded_by === user?.id) && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteFileMut.mutate(f)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {files.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">Nenhum arquivo nesta pasta.</div>
          )}
        </div>
      )}

      {/* Folder create/edit modal */}
      <Dialog open={folderModal} onOpenChange={(o) => !o && closeFolderModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editFolder ? 'Editar Pasta' : 'Nova Pasta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome da pasta" value={folderName} onChange={(e) => setFolderName(e.target.value)} />
            <Textarea placeholder="Descrição (opcional)" value={folderDesc} onChange={(e) => setFolderDesc(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeFolderModal}>Cancelar</Button>
            <Button disabled={!folderName.trim() || saveFolderMut.isPending} onClick={() => saveFolderMut.mutate()}>
              {saveFolderMut.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview modal */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader><DialogTitle>Visualização</DialogTitle></DialogHeader>
          {previewUrl && (
            previewUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)/i)
              ? <img src={previewUrl} alt="preview" className="max-h-[70vh] object-contain mx-auto rounded" />
              : <iframe src={previewUrl} className="w-full h-[70vh] rounded border" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
