import { useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ObjectsTab } from '@/components/settings/ObjectsTab';
import { FunnelTab } from '@/components/settings/FunnelTab';
import { LossReasonsTab } from '@/components/settings/LossReasonsTab';
import { TeamsTab } from '@/components/settings/TeamsTab';
import { PermissionsTab } from '@/components/settings/PermissionsTab';
import { OriginsTab } from '@/components/settings/OriginsTab';
import { QualificationTab } from '@/components/settings/QualificationTab';
import { AlertsTab } from '@/components/settings/AlertsTab';
import { ImportTab } from '@/components/settings/ImportTab';

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
          <p className="text-sm text-muted-foreground">Gerencie objetos, funis, motivos de perda, equipes, permissões, origens, qualificação, alertas e importação</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full">
          <TabsTrigger value="objects" className="flex-1 text-xs">Objetos</TabsTrigger>
          <TabsTrigger value="funnels" className="flex-1 text-xs">Funis</TabsTrigger>
          <TabsTrigger value="loss-reasons" className="flex-1 text-xs">Motivos de Perda</TabsTrigger>
          <TabsTrigger value="origins" className="flex-1 text-xs">Origens</TabsTrigger>
          <TabsTrigger value="qualification" className="flex-1 text-xs">Qualificação</TabsTrigger>
          <TabsTrigger value="teams" className="flex-1 text-xs">Equipes</TabsTrigger>
          <TabsTrigger value="permissions" className="flex-1 text-xs">Permissões</TabsTrigger>
          <TabsTrigger value="alerts" className="flex-1 text-xs">Alertas</TabsTrigger>
          <TabsTrigger value="import" className="flex-1 text-xs">Importação</TabsTrigger>
        </TabsList>

        <TabsContent value="objects"><ObjectsTab /></TabsContent>
        <TabsContent value="funnels"><FunnelTab /></TabsContent>
        <TabsContent value="loss-reasons"><LossReasonsTab /></TabsContent>
        <TabsContent value="origins"><OriginsTab /></TabsContent>
        <TabsContent value="qualification"><QualificationTab /></TabsContent>
        <TabsContent value="teams"><TeamsTab /></TabsContent>
        <TabsContent value="permissions"><PermissionsTab /></TabsContent>
        <TabsContent value="alerts"><AlertsTab /></TabsContent>
        <TabsContent value="import"><ImportTab /></TabsContent>
      </Tabs>
    </div>
  );
}
