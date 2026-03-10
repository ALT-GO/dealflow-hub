import { useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ObjectsTab } from '@/components/settings/ObjectsTab';
import { FunnelTab } from '@/components/settings/FunnelTab';
import { LossReasonsTab } from '@/components/settings/LossReasonsTab';
import { TeamsTab } from '@/components/settings/TeamsTab';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('objects');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <SettingsIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground">Gerencie objetos, funis, motivos de perda e equipes</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="objects">Objetos (Campos)</TabsTrigger>
          <TabsTrigger value="funnels">Funis (Estágios)</TabsTrigger>
          <TabsTrigger value="loss-reasons">Motivos de Perda</TabsTrigger>
          <TabsTrigger value="teams">Equipes</TabsTrigger>
        </TabsList>

        <TabsContent value="objects"><ObjectsTab /></TabsContent>
        <TabsContent value="funnels"><FunnelTab /></TabsContent>
        <TabsContent value="loss-reasons"><LossReasonsTab /></TabsContent>
        <TabsContent value="teams"><TeamsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
