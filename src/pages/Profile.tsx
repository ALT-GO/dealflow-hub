import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Camera, Save } from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [cargo, setCargo] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setCargo((profile as any).cargo || '');
    }
  }, [profile]);

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);

    const ext = file.name.split('.').pop();
    const path = `avatars/${user.id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error('Erro ao enviar foto');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
    const avatarUrl = urlData.publicUrl + '?t=' + Date.now();

    await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('user_id', user.id);
    queryClient.invalidateQueries({ queryKey: ['my-profile'] });
    queryClient.invalidateQueries({ queryKey: ['profiles-map'] });
    toast.success('Foto atualizada!');
    setUploading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim() || null,
    } as any).eq('user_id', user.id);

    if (error) {
      toast.error('Erro ao salvar');
      setSaving(false);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['my-profile'] });
    queryClient.invalidateQueries({ queryKey: ['profiles-map'] });
    toast.success('Perfil atualizado!');
    setSaving(false);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">Meu Perfil</h1>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold">Foto e Informações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">
                  {getInitials(fullName || user?.email || '?')}
                </AvatarFallback>
              </Avatar>
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <Camera className="h-5 w-5 text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={handleUploadAvatar} disabled={uploading} />
              </label>
            </div>
            <div>
              <p className="font-medium text-foreground">{fullName || user?.email}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome Completo</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Seu nome" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cargo</Label>
              <Input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ex: Gerente Comercial" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">E-mail</Label>
              <Input value={user?.email || ''} disabled className="bg-muted" />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
