import { useState, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { storage } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
  Upload, FileText, FileSpreadsheet, Image as ImageIcon, File, Search,
  Download, Eye, Trash2, X, Paperclip, FolderOpen,
} from 'lucide-react';

const CATEGORIES = [
  { value: 'contrato', label: 'Contrato' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'documento_tecnico', label: 'Documento Técnico' },
  { value: 'outros', label: 'Outros' },
];

const categoryColors: Record<string, string> = {
  contrato: 'bg-success/10 text-success',
  proposta: 'bg-primary/10 text-primary',
  documento_tecnico: 'bg-warning/10 text-warning',
  outros: 'bg-muted text-muted-foreground',
};

interface FileAttachment {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  category: string;
  uploaded_by: string;
  created_at: string;
}

interface Props {
  entityType: 'company' | 'contact' | 'deal';
  entityId: string;
  companyId?: string;
  contactId?: string;
}

function getFileIcon(type: string, name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return <FileText className="h-5 w-5 text-destructive" />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet className="h-5 w-5 text-success" />;
  if (['doc', 'docx'].includes(ext)) return <FileText className="h-5 w-5 text-primary" />;
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return <ImageIcon className="h-5 w-5 text-warning" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPreviewable(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
}

export function FileManager({ entityType, entityId, companyId, contactId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('outros');
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-all'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
  });

  const { data: userRole } = useQuery({
    queryKey: ['my-role', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
      return data?.role || 'vendedor';
    },
    enabled: !!user,
  });

  const isAdmin = userRole === 'admin';

  const { data: files = [], isLoading } = useQuery<FileAttachment[]>({
    queryKey: ['file-attachments', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('file_attachments')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as FileAttachment[];
    },
    enabled: !!entityId,
  });

  const filteredFiles = files.filter(f =>
    f.file_name.toLowerCase().includes(search.toLowerCase())
  );

  const getUploaderName = (userId: string) =>
    profiles.find(p => p.user_id === userId)?.full_name || 'Usuário';

  const getInitials = (userId: string) => {
    const p = profiles.find(pr => pr.user_id === userId);
    if (!p?.full_name) return '?';
    return p.full_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  };

  const uploadFiles = useCallback(async (fileList: FileList | File[]) => {
    if (!user || !entityId) return;
    const filesToUpload = Array.from(fileList);
    if (filesToUpload.length === 0) return;

    setUploading(true);
    let successCount = 0;

    for (const file of filesToUpload) {
      const ext = file.name.split('.').pop() || '';
      const storagePath = `${entityType}/${entityId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await storage.upload(storagePath, file);
      if (uploadError) {
        toast.error(`Erro ao enviar ${file.name}: ${uploadError}`);
        continue;
      }

      const { error: dbError } = await supabase.from('file_attachments').insert({
        entity_type: entityType,
        entity_id: entityId,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || ext,
        storage_path: storagePath,
        category,
        uploaded_by: user.id,
      } as any);

      if (dbError) {
        toast.error(`Erro ao registrar ${file.name}`);
        continue;
      }

      // Log to timeline
      const myName = profiles.find(p => p.user_id === user.id)?.full_name || 'Usuário';
      await supabase.from('activities').insert({
        type: 'file_uploaded',
        title: `${myName} anexou "${file.name}"`,
        description: `Categoria: ${CATEGORIES.find(c => c.value === category)?.label || category} · ${formatSize(file.size)}`,
        company_id: entityType === 'company' ? entityId : companyId || null,
        contact_id: entityType === 'contact' ? entityId : contactId || null,
        created_by: user.id,
      });

      successCount++;
    }

    setUploading(false);
    if (successCount > 0) {
      toast.success(`${successCount} arquivo${successCount > 1 ? 's' : ''} enviado${successCount > 1 ? 's' : ''}`);
      queryClient.invalidateQueries({ queryKey: ['file-attachments', entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ['company-activities'] });
      queryClient.invalidateQueries({ queryKey: ['contact-activities'] });
    }
  }, [user, entityId, entityType, category, companyId, contactId, profiles, queryClient]);

  const handleDelete = async (file: FileAttachment) => {
    if (!user) return;
    const { error: storageErr } = await storage.remove([file.storage_path]);
    if (storageErr) { toast.error('Erro ao remover arquivo'); return; }

    await supabase.from('file_attachments').delete().eq('id', file.id);

    const myName = profiles.find(p => p.user_id === user.id)?.full_name || 'Usuário';
    await supabase.from('activities').insert({
      type: 'file_deleted',
      title: `${myName} removeu "${file.file_name}"`,
      description: null,
      company_id: entityType === 'company' ? entityId : companyId || null,
      contact_id: entityType === 'contact' ? entityId : contactId || null,
      created_by: user.id,
    });

    toast.success('Arquivo removido');
    queryClient.invalidateQueries({ queryKey: ['file-attachments', entityType, entityId] });
  };

  const handlePreview = (file: FileAttachment) => {
    const url = storage.getPublicUrl(file.storage_path);
    setPreviewUrl(url);
    setPreviewName(file.file_name);
  };

  const handleDownload = (file: FileAttachment) => {
    const url = storage.getPublicUrl(file.storage_path);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.file_name;
    a.target = '_blank';
    a.click();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }, [uploadFiles]);

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors duration-200 ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload className={`h-8 w-8 mx-auto mb-2 ${dragOver ? 'text-primary' : 'text-muted-foreground'}`} />
        <p className="text-sm text-foreground font-medium">
          {dragOver ? 'Solte os arquivos aqui' : 'Arraste e solte arquivos aqui'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, XLSX, PNG, JPG — até 20MB</p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs"
          >
            <Paperclip className="h-3.5 w-3.5 mr-1" />
            {uploading ? 'Enviando...' : 'Selecionar'}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.svg,.txt"
          onChange={(e) => {
            if (e.target.files) uploadFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Search */}
      {files.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar arquivos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
      )}

      {/* File list */}
      <ScrollArea className="max-h-[360px]">
        <div className="space-y-1.5">
          {filteredFiles.map(file => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors group"
            >
              <div className="shrink-0">{getFileIcon(file.file_type, file.file_name)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{file.file_name}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <span>{formatSize(file.file_size)}</span>
                  <span>·</span>
                  <span>{new Date(file.created_at).toLocaleDateString('pt-BR')}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-[7px] bg-primary/10 text-primary font-semibold">
                        {getInitials(file.uploaded_by)}
                      </AvatarFallback>
                    </Avatar>
                    {getUploaderName(file.uploaded_by)}
                  </span>
                </div>
              </div>
              <Badge variant="secondary" className={`text-[9px] shrink-0 ${categoryColors[file.category] || ''}`}>
                {CATEGORIES.find(c => c.value === file.category)?.label || file.category}
              </Badge>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {isPreviewable(file.file_name) && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePreview(file)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(file)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {isAdmin && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(file)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {filteredFiles.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                {search ? 'Nenhum arquivo encontrado' : 'Nenhum arquivo anexado'}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Preview dialog */}
      <Dialog open={!!previewUrl} onOpenChange={(o) => { if (!o) { setPreviewUrl(null); setPreviewName(''); } }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-sm truncate">{previewName}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden" style={{ minHeight: 400 }}>
              {previewName.toLowerCase().endsWith('.pdf') ? (
                <iframe src={previewUrl} className="w-full h-[70vh] rounded" title={previewName} />
              ) : (
                <img src={previewUrl} alt={previewName} className="max-w-full max-h-[70vh] object-contain" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
