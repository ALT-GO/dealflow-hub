import { useState } from 'react';
import { Settings as SettingsIcon, Boxes, GitBranch, XCircle, MapPin, ClipboardCheck, Users, Shield, Bell, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ObjectsTab } from '@/components/settings/ObjectsTab';
import { FunnelTab } from '@/components/settings/FunnelTab';
import { LossReasonsTab } from '@/components/settings/LossReasonsTab';
import { TeamsTab } from '@/components/settings/TeamsTab';
import { PermissionsTab } from '@/components/settings/PermissionsTab';
import { OriginsTab } from '@/components/settings/OriginsTab';
import { QualificationTab } from '@/components/settings/QualificationTab';
import { AlertsTab } from '@/components/settings/AlertsTab';
import { ImportTab } from '@/components/settings/ImportTab';

const MENU_ITEMS = [
  { key: 'objects', label: 'Objetos', icon: Boxes },
  { key: 'funnels', label: 'Funis', icon: GitBranch },
  { key: 'loss-reasons', label: 'Motivos de Perda', icon: XCircle },
  { key: 'origins', label: 'Origens', icon: MapPin },
  { key: 'qualification', label: 'Qualificação', icon: ClipboardCheck },
  { key: 'teams', label: 'Equipes', icon: Users },
  { key: 'permissions', label: 'Permissões', icon: Shield },
  { key: 'alerts', label: 'Alertas', icon: Bell },
  { key: 'import', label: 'Importação', icon: Upload },
];

const CONTENT: Record<string, React.ReactNode> = {
  objects: <ObjectsTab />,
  funnels: <FunnelTab />,
  'loss-reasons': <LossReasonsTab />,
  origins: <OriginsTab />,
  qualification: <QualificationTab />,
  teams: <TeamsTab />,
  permissions: <PermissionsTab />,
  alerts: <AlertsTab />,
  import: <ImportTab />,
};

export default function Settings() {
  const [activeTab, setActiveTab] = useState('objects');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <SettingsIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground">Gerencie objetos, funis, equipes, permissões e mais</p>
        </div>
      </div>

      <div className="flex gap-6 min-h-[600px]">
        {/* Vertical sidebar menu */}
        <nav className="w-56 shrink-0 space-y-1">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {CONTENT[activeTab]}
        </div>
      </div>
    </div>
  );
}
