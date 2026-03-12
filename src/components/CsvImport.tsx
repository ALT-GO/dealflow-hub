import { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, ArrowRight, Building2, Users, Briefcase, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type FieldMapping = Record<number, string>;

interface CsvImportProps {
  entityType: 'companies' | 'contacts' | 'deals';
  onComplete: () => void;
}

const COMPANY_FIELDS = [
  { value: 'company_name', label: 'Nome da Empresa' },
  { value: 'company_domain', label: 'Domínio' },
  { value: 'company_sector', label: 'Setor' },
  { value: 'company_phone', label: 'Telefone' },
];

const CONTACT_FIELDS = [
  { value: 'contact_name', label: 'Nome do Contato' },
  { value: 'contact_email', label: 'E-mail' },
  { value: 'contact_role', label: 'Cargo' },
  { value: 'contact_lead_source', label: 'Origem do Lead' },
  { value: 'contact_status', label: 'Status' },
];

const DEAL_FIELDS = [
  { value: 'deal_name', label: 'Nome do Negócio' },
  { value: 'deal_value', label: 'Valor' },
  { value: 'deal_stage', label: 'Etapa do Funil' },
  { value: 'deal_business_area', label: 'Área de Negócio' },
  { value: 'deal_market', label: 'Mercado' },
  { value: 'deal_contract_type', label: 'Tipo de Contrato' },
  { value: 'deal_scope', label: 'Escopo' },
  { value: 'deal_close_date', label: 'Data de Fechamento' },
  { value: 'deal_target_delivery_date', label: 'Data de Entrega Alvo' },
  { value: 'deal_proposal_delivery_date', label: 'Data de Entrega da Proposta' },
  { value: 'deal_budget_start_date', label: 'Data Início Orçamento' },
  { value: 'deal_vendedor_externo', label: 'Vendedor Externo' },
  { value: 'deal_tipo_negocio', label: 'Tipo de Negócio' },
  { value: 'deal_endereco_execucao', label: 'Endereço de Execução' },
  { value: 'deal_state', label: 'Estado (UF)' },
  { value: 'deal_team_type', label: 'Tipo de Equipe' },
  { value: 'deal_qualification_level', label: 'Nível de Qualificação' },
  { value: 'deal_carbono_zero', label: 'Carbono Zero?' },
  { value: 'deal_cortex', label: 'Cortex?' },
  { value: 'deal_estudo_equipe', label: 'Há estudo de equipe definido?' },
  { value: 'deal_profit_margin', label: 'Margem de Lucro (%)' },
  { value: 'deal_origin_id', label: 'Origem (ID)' },
  { value: 'deal_loss_reason', label: 'Motivo de Perda' },
  { value: 'deal_owner', label: 'Proprietário do Negócio' },
  { value: 'deal_orcamentista', label: 'Orçamentista Responsável' },
];

const ALL_FIELDS = [
  { value: '', label: '— Ignorar —' },
  ...COMPANY_FIELDS.map(f => ({ ...f, category: 'company' as const })),
  ...CONTACT_FIELDS.map(f => ({ ...f, category: 'contact' as const })),
  ...DEAL_FIELDS.map(f => ({ ...f, category: 'deal' as const })),
];

/* Smart auto-detection mapping */
const DETECT_MAP: Record<string, string> = {
  'empresa': 'company_name', 'company': 'company_name', 'nome da empresa': 'company_name', 'razao social': 'company_name',
  'dominio': 'company_domain', 'domain': 'company_domain', 'site': 'company_domain', 'website': 'company_domain',
  'setor': 'company_sector', 'sector': 'company_sector', 'segmento': 'company_sector',
  'telefone empresa': 'company_phone', 'phone': 'company_phone', 'fone': 'company_phone',
  'contato': 'contact_name', 'nome do contato': 'contact_name', 'contact': 'contact_name', 'nome contato': 'contact_name',
  'email': 'contact_email', 'e-mail': 'contact_email', 'e mail': 'contact_email',
  'cargo': 'contact_role', 'role': 'contact_role', 'funcao': 'contact_role',
  'origem': 'contact_lead_source', 'lead source': 'contact_lead_source', 'origem do lead': 'contact_lead_source',
  'status': 'contact_status', 'status contato': 'contact_status',
  'negocio': 'deal_name', 'nome do negocio': 'deal_name', 'deal': 'deal_name', 'oportunidade': 'deal_name', 'proposta': 'deal_name',
  'valor': 'deal_value', 'value': 'deal_value', 'preco': 'deal_value', 'price': 'deal_value',
  'estagio': 'deal_stage', 'stage': 'deal_stage', 'etapa': 'deal_stage', 'fase': 'deal_stage',
  'area de negocio': 'deal_business_area', 'area': 'deal_business_area',
  'mercado': 'deal_market', 'market': 'deal_market',
  'tipo de contrato': 'deal_contract_type', 'contrato': 'deal_contract_type',
  'escopo': 'deal_scope', 'scope': 'deal_scope',
  'data fechamento': 'deal_close_date', 'close date': 'deal_close_date', 'data de fechamento': 'deal_close_date',
  'data entrega': 'deal_target_delivery_date', 'data de entrega': 'deal_target_delivery_date', 'prazo': 'deal_target_delivery_date',
  'data proposta': 'deal_proposal_delivery_date', 'entrega proposta': 'deal_proposal_delivery_date',
  'data inicio orcamento': 'deal_budget_start_date', 'inicio orcamento': 'deal_budget_start_date',
  'vendedor externo': 'deal_vendedor_externo', 'vendedor': 'deal_vendedor_externo', 'parceiro': 'deal_vendedor_externo',
  'tipo de negocio': 'deal_tipo_negocio', 'tipo negocio': 'deal_tipo_negocio',
  'endereco execucao': 'deal_endereco_execucao', 'endereco de execucao': 'deal_endereco_execucao', 'local': 'deal_endereco_execucao',
  'estado': 'deal_state', 'uf': 'deal_state', 'state': 'deal_state',
  'tipo de equipe': 'deal_team_type', 'equipe': 'deal_team_type', 'team type': 'deal_team_type',
  'nivel de qualificacao': 'deal_qualification_level', 'qualificacao': 'deal_qualification_level',
  'carbono zero': 'deal_carbono_zero', 'carbono': 'deal_carbono_zero',
  'cortex': 'deal_cortex',
  'cliente possui equipe': 'deal_estudo_equipe', 'possui equipe': 'deal_estudo_equipe', 'estudo equipe': 'deal_estudo_equipe',
  'ha estudo de equipe': 'deal_estudo_equipe', 'estudo de equipe': 'deal_estudo_equipe',
  'margem': 'deal_profit_margin', 'margem de lucro': 'deal_profit_margin', 'profit margin': 'deal_profit_margin',
  'motivo de perda': 'deal_loss_reason', 'motivo perda': 'deal_loss_reason', 'loss reason': 'deal_loss_reason',
  'proprietario': 'deal_owner', 'owner': 'deal_owner', 'responsavel': 'deal_owner', 'proprietario do negocio': 'deal_owner',
  'orcamentista': 'deal_orcamentista', 'estimator': 'deal_orcamentista', 'orcamentista responsavel': 'deal_orcamentista',
  'etapa do funil': 'deal_stage', 'funil': 'deal_stage', 'pipeline': 'deal_stage',
};

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if ((ch === ',' || ch === ';' || ch === '\t') && !inQuotes) { result.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  });
}

function parseBool(s: string): boolean {
  const n = s.toLowerCase().trim();
  return ['sim', 'yes', 'true', '1', 's', 'y', 'verdadeiro'].includes(n);
}

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function autoDetect(headers: string[]): FieldMapping {
  // All fields default to "ignore" (empty string)
  const map: FieldMapping = {};
  headers.forEach((_h, i) => {
    map[i] = '';
  });
  return map;
}

function getEntityLabel(entityType: CsvImportProps['entityType']) {
  if (entityType === 'companies') return 'Empresas';
  if (entityType === 'contacts') return 'Contatos';
  return 'Negócios';
}

export function CsvImport({ entityType, onComplete }: CsvImportProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'map' | 'importing' | 'done'>('upload');
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [importResult, setImportResult] = useState({ success: 0, errors: 0, details: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  // Toggles for what to import
  const [importCompanies, setImportCompanies] = useState(true);
  const [importContacts, setImportContacts] = useState(entityType === 'contacts' || entityType === 'deals');
  const [importDeals, setImportDeals] = useState(entityType === 'deals');

  // Detect which categories have mapped fields
  const mappedCategories = useMemo(() => {
    const cats = { company: false, contact: false, deal: false };
    Object.values(mapping).forEach(v => {
      if (v?.startsWith('company_')) cats.company = true;
      if (v?.startsWith('contact_')) cats.contact = true;
      if (v?.startsWith('deal_')) cats.deal = true;
    });
    return cats;
  }, [mapping]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length < 2) { toast.error('O arquivo precisa ter pelo menos 2 linhas (cabeçalho + dados)'); return; }
      const hdrs = parsed[0];
      setHeaders(hdrs);
      setRows(parsed.slice(1));
      const autoMap = autoDetect(hdrs);
      setMapping(autoMap);

      // Auto-enable toggles based on detected fields
      const detected = { company: false, contact: false, deal: false };
      Object.values(autoMap).forEach(v => {
        if (v?.startsWith('company_')) detected.company = true;
        if (v?.startsWith('contact_')) detected.contact = true;
        if (v?.startsWith('deal_')) detected.deal = true;
      });
      setImportCompanies(detected.company || entityType === 'companies');
      setImportContacts(detected.contact || entityType === 'contacts');
      setImportDeals(detected.deal || entityType === 'deals');

      setStep('map');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!user) return;
    setStep('importing');
    let success = 0;
    let errors = 0;
    const details: string[] = [];

    // Build company cache
    const { data: existingCompanies } = await supabase.from('companies').select('id, name');
    const companyMap = new Map<string, string>((existingCompanies || []).map(c => [c.name.toLowerCase(), c.id]));

    // Build funnel stages cache for stage matching
    const { data: funnelStages } = await supabase.from('funnel_stages').select('key, label').order('sort_order');
    const stageList = funnelStages || [];
    const resolveStage = (input: string | undefined): string => {
      if (!input?.trim()) return 'appointmentscheduled';
      const n = normalize(input);
      // Match by label (case-insensitive, accent-insensitive)
      const byLabel = stageList.find(s => normalize(s.label) === n);
      if (byLabel) return byLabel.key;
      // Match by key
      const byKey = stageList.find(s => s.key === n);
      if (byKey) return byKey.key;
      // Partial match
      const partial = stageList.find(s => normalize(s.label).includes(n) || n.includes(normalize(s.label)));
      if (partial) return partial.key;
      return 'prospeccao';
    };

    // Build profiles cache for owner/orcamentista matching
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name');
    const profileList = profiles || [];
    const resolveUser = (input: string | undefined): string | null => {
      if (!input?.trim()) return null;
      const n = normalize(input);
      // Exact name match
      const exact = profileList.find(p => p.full_name && normalize(p.full_name) === n);
      if (exact) return exact.user_id;
      // Partial match
      const partial = profileList.find(p => p.full_name && (normalize(p.full_name).includes(n) || n.includes(normalize(p.full_name))));
      if (partial) return partial.user_id;
      // Email-like match
      const byEmail = profileList.find(p => p.full_name && p.full_name.toLowerCase() === input.trim().toLowerCase());
      if (byEmail) return byEmail.user_id;
      return null;
    };

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      try {
        // Extract values by category
        const vals: Record<string, string> = {};
        Object.entries(mapping).forEach(([colIdx, field]) => {
          if (field && row[Number(colIdx)]) vals[field] = row[Number(colIdx)];
        });

        let companyId: string | null = null;

        // 1. Import Company
        if (importCompanies && vals.company_name) {
          const existing = companyMap.get(vals.company_name.toLowerCase());
          if (existing) {
            companyId = existing;
          } else {
            const companyRecord: any = {
              name: vals.company_name,
              created_by: user.id,
            };
            if (vals.company_domain) companyRecord.domain = vals.company_domain;
            if (vals.company_sector) companyRecord.sector = vals.company_sector;
            if (vals.company_phone) companyRecord.phone = vals.company_phone;
            const { data: newC, error: cErr } = await supabase.from('companies').insert(companyRecord).select('id').single();
            if (cErr) {
              details.push(`Linha ${ri + 2}: Erro empresa "${vals.company_name}"`);
            } else if (newC) {
              companyId = newC.id;
              companyMap.set(vals.company_name.toLowerCase(), newC.id);
            }
          }
        } else if (vals.company_name) {
          // Even if not importing companies, resolve existing
          companyId = companyMap.get(vals.company_name.toLowerCase()) || null;
        }

        // 2. Import Contact
        let contactId: string | null = null;
        if (importContacts && vals.contact_name) {
          if (!companyId) {
            // Try to create company from name if available
            if (vals.company_name) {
              const { data: newC } = await supabase.from('companies').insert({ name: vals.company_name, created_by: user.id }).select('id').single();
              if (newC) { companyId = newC.id; companyMap.set(vals.company_name.toLowerCase(), newC.id); }
            }
          }
          if (companyId) {
            const contactRecord: any = {
              name: vals.contact_name,
              company_id: companyId,
              created_by: user.id,
            };
            if (vals.contact_email) contactRecord.email = vals.contact_email;
            if (vals.contact_role) contactRecord.role = vals.contact_role;
            if (vals.contact_lead_source) contactRecord.lead_source = vals.contact_lead_source;
            if (vals.contact_status) contactRecord.status = vals.contact_status;
            const { data: newContact, error: ctErr } = await supabase.from('contacts').insert(contactRecord).select('id').single();
            if (ctErr) {
              details.push(`Linha ${ri + 2}: Erro contato "${vals.contact_name}"`);
            } else if (newContact) {
              contactId = newContact.id;
            }
          } else {
            details.push(`Linha ${ri + 2}: Contato "${vals.contact_name}" sem empresa vinculada`);
          }
        }

        // 3. Import Deal
        if (importDeals && vals.deal_name) {
          if (!companyId && vals.company_name) {
            const { data: newC } = await supabase.from('companies').insert({ name: vals.company_name, created_by: user.id }).select('id').single();
            if (newC) { companyId = newC.id; companyMap.set(vals.company_name.toLowerCase(), newC.id); }
          }
          if (companyId) {
            const dealRecord: any = {
              name: vals.deal_name,
              company_id: companyId,
              owner_id: user.id,
              approval_status: 'pending',
            };
            if (contactId) dealRecord.contact_id = contactId;
            if (vals.deal_value) {
              const parsed = parseFloat(vals.deal_value.replace(/[^\d.,]/g, '').replace(',', '.'));
              dealRecord.value = isNaN(parsed) ? 0 : parsed;
            }
            // Stage — resolve to valid funnel key or fallback to 'prospeccao'
            dealRecord.stage = resolveStage(vals.deal_stage);

            if (vals.deal_business_area) dealRecord.business_area = vals.deal_business_area;
            if (vals.deal_market) dealRecord.market = vals.deal_market;
            if (vals.deal_contract_type) dealRecord.contract_type = vals.deal_contract_type;
            if (vals.deal_scope) dealRecord.scope = vals.deal_scope;
            if (vals.deal_close_date) dealRecord.close_date = vals.deal_close_date;
            if (vals.deal_target_delivery_date) dealRecord.target_delivery_date = vals.deal_target_delivery_date;
            if (vals.deal_proposal_delivery_date) dealRecord.proposal_delivery_date = vals.deal_proposal_delivery_date;
            if (vals.deal_budget_start_date) dealRecord.budget_start_date = vals.deal_budget_start_date;
            if (vals.deal_vendedor_externo) dealRecord.vendedor_externo = vals.deal_vendedor_externo;
            if (vals.deal_tipo_negocio) dealRecord.tipo_negocio = vals.deal_tipo_negocio;
            if (vals.deal_endereco_execucao) dealRecord.endereco_execucao = vals.deal_endereco_execucao;
            if (vals.deal_state) dealRecord.state = vals.deal_state;
            if (vals.deal_team_type) dealRecord.team_type = vals.deal_team_type;
            if (vals.deal_qualification_level) dealRecord.qualification_level = vals.deal_qualification_level;
            if (vals.deal_estudo_equipe) dealRecord.estudo_equipe = vals.deal_estudo_equipe;
            if (vals.deal_origin_id) dealRecord.origin_id = vals.deal_origin_id;
            if (vals.deal_loss_reason) dealRecord.loss_reason = vals.deal_loss_reason;
            if (vals.deal_profit_margin) {
              const pm = parseFloat(vals.deal_profit_margin.replace(/[^\d.,]/g, '').replace(',', '.'));
              if (!isNaN(pm)) dealRecord.profit_margin = pm;
            }
            // Boolean fields — parse "sim", "yes", "true", "1" as true
            if (vals.deal_carbono_zero !== undefined) dealRecord.carbono_zero = parseBool(vals.deal_carbono_zero);
            if (vals.deal_cortex !== undefined) dealRecord.cortex = parseBool(vals.deal_cortex);
            // Owner — resolve user by name/email or keep current user
            const resolvedOwner = resolveUser(vals.deal_owner);
            if (resolvedOwner) dealRecord.owner_id = resolvedOwner;
            // Orcamentista — resolve user by name/email
            const resolvedOrc = resolveUser(vals.deal_orcamentista);
            if (resolvedOrc) dealRecord.orcamentista_id = resolvedOrc;
            const { error: dErr } = await supabase.from('deals').insert(dealRecord);
            if (dErr) {
              details.push(`Linha ${ri + 2}: Erro negócio "${vals.deal_name}"`);
            }
          } else {
            details.push(`Linha ${ri + 2}: Negócio "${vals.deal_name}" sem empresa vinculada`);
          }
        }

        // Count success if at least one entity was processed without error for this row
        const hasEntity = (importCompanies && vals.company_name) || (importContacts && vals.contact_name) || (importDeals && vals.deal_name);
        if (hasEntity) success++;
      } catch {
        errors++;
        details.push(`Linha ${ri + 2}: Erro inesperado`);
      }
    }

    setImportResult({ success, errors: details.length, details: details.slice(0, 20).join('\n') });
    setStep('done');
  };

  const reset = () => {
    setStep('upload');
    setRows([]);
    setHeaders([]);
    setMapping({});
    setImportResult({ success: 0, errors: 0, details: '' });
    setImportCompanies(true);
    setImportContacts(entityType === 'contacts' || entityType === 'deals');
    setImportDeals(entityType === 'deals');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = (o: boolean) => {
    if (!o) { reset(); onComplete(); }
    setOpen(o);
  };

  // Check if required fields are mapped for enabled categories
  const canImport = useMemo(() => {
    return importCompanies || importContacts || importDeals;
  }, [importCompanies, importContacts, importDeals]);

  // Similarity score between two strings (higher = more similar)
  const similarity = (a: string, b: string): number => {
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb) return 100;
    if (nb.includes(na) || na.includes(nb)) return 80;
    // Count common words
    const wordsA = na.split(/\s+/);
    const wordsB = nb.split(/\s+/);
    let common = 0;
    for (const w of wordsA) {
      if (w.length < 2) continue;
      if (wordsB.some(wb => wb.includes(w) || w.includes(wb))) common++;
    }
    if (common > 0) return 30 + common * 20;
    // Check character overlap
    let overlap = 0;
    for (let i = 0; i < Math.min(na.length, nb.length); i++) {
      if (na[i] === nb[i]) overlap++;
    }
    return Math.round((overlap / Math.max(na.length, nb.length)) * 30);
  };

  // Build grouped and sorted fields for a given header
  const getFieldsForHeader = (headerText: string) => {
    const groups = [
      { key: 'Empresa', fields: COMPANY_FIELDS },
      { key: 'Contato', fields: CONTACT_FIELDS },
      { key: 'Negócio', fields: DEAL_FIELDS },
    ];

    // Sort groups: put the group with highest similarity first
    const scoredGroups = groups.map(g => {
      const maxScore = Math.max(...g.fields.map(f => similarity(headerText, f.label)));
      const sortedFields = [...g.fields].sort((a, b) => similarity(headerText, b.label) - similarity(headerText, a.label));
      return { ...g, fields: sortedFields, maxScore };
    }).sort((a, b) => b.maxScore - a.maxScore);

    return scoredGroups;
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4 mr-2" />Importar {getEntityLabel(entityType)}
      </Button>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Importar {getEntityLabel(entityType)}
            </DialogTitle>
          </DialogHeader>

          {step === 'upload' && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Faça upload de um arquivo CSV ou TXT. O sistema identificará automaticamente os campos e os agrupará por categoria.
              </p>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,.xlsx" onChange={handleFile} className="hidden" id={`csv-upload-${entityType}`} />
                <label htmlFor={`csv-upload-${entityType}`} className="cursor-pointer space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Clique para selecionar o arquivo</p>
                  <p className="text-xs text-muted-foreground">CSV, TXT (separado por vírgula, ponto-e-vírgula ou tab)</p>
                </label>
              </div>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {rows.length} registros encontrados. Os campos foram identificados automaticamente. Ajuste o mapeamento se necessário.
              </p>

              {/* Category toggles */}
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">O que importar?</p>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Switch id="imp-companies" checked={importCompanies} onCheckedChange={setImportCompanies} />
                    <Label htmlFor="imp-companies" className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Building2 className="h-4 w-4 text-primary" /> Empresas
                    </Label>
                    {mappedCategories.company && <Badge variant="secondary" className="text-[10px]">Detectado</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="imp-contacts" checked={importContacts} onCheckedChange={setImportContacts} />
                    <Label htmlFor="imp-contacts" className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Users className="h-4 w-4 text-primary" /> Contatos
                    </Label>
                    {mappedCategories.contact && <Badge variant="secondary" className="text-[10px]">Detectado</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="imp-deals" checked={importDeals} onCheckedChange={setImportDeals} />
                    <Label htmlFor="imp-deals" className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Briefcase className="h-4 w-4 text-primary" /> Negócios
                    </Label>
                    {mappedCategories.deal && <Badge variant="secondary" className="text-[10px]">Detectado</Badge>}
                  </div>
                </div>
              </div>

              {/* Field mapping grouped by category */}
              <Accordion type="multiple" defaultValue={['mapping']} className="w-full">
                <AccordionItem value="mapping" className="border-border">
                  <AccordionTrigger className="text-sm font-semibold">
                    Mapeamento de Campos ({Object.values(mapping).filter(v => v).length} mapeados)
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {headers.map((h, i) => {
                        const currentField = ALL_FIELDS.find(f => f.value === mapping[i]);
                        const category = mapping[i]?.startsWith('company_') ? 'company'
                          : mapping[i]?.startsWith('contact_') ? 'contact'
                          : mapping[i]?.startsWith('deal_') ? 'deal' : null;
                        const catColor = category === 'company' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : category === 'contact' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : category === 'deal' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                          : '';
                        const catLabel = category === 'company' ? 'Empresa' : category === 'contact' ? 'Contato' : category === 'deal' ? 'Negócio' : '';

                        return (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-sm font-medium min-w-[140px] truncate text-foreground" title={h}>{h}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {category && <Badge className={`text-[9px] shrink-0 ${catColor}`}>{catLabel}</Badge>}
                            <Select value={mapping[i] || 'ignore'} onValueChange={(v) => setMapping(prev => ({ ...prev, [i]: v === 'ignore' ? '' : v }))}>
                              <SelectTrigger className="w-52 h-8 text-xs">
                                <SelectValue placeholder="Selecione o campo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ignore">— Ignorar —</SelectItem>
                                {getFieldsForHeader(h).map(group => (
                                  <SelectGroup key={group.key}>
                                    <SelectLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{group.key}</SelectLabel>
                                    {group.fields.map(f => (
                                      <SelectItem key={f.value} value={f.value}>
                                        {f.label}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Preview */}
              <div className="border rounded-lg overflow-x-auto max-h-36">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h, i) => {
                        const field = ALL_FIELDS.find(f => f.value === mapping[i]);
                        return <TableHead key={i} className="text-xs whitespace-nowrap">{field?.label || h}</TableHead>;
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 3).map((row, ri) => (
                      <TableRow key={ri}>
                        {row.map((cell, ci) => (
                          <TableCell key={ci} className="text-xs whitespace-nowrap max-w-[150px] truncate">{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Validation messages */}
              {!canImport && (
                <p className="text-xs text-destructive">
                  Ative pelo menos uma categoria para importar.
                </p>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={reset}>Voltar</Button>
                <Button onClick={handleImport} disabled={!canImport}>
                  Importar {rows.length} registros
                </Button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="py-12 text-center space-y-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Importando registros...</p>
            </div>
          )}

          {step === 'done' && (
            <div className="py-8 text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
              <p className="text-lg font-bold text-foreground">Importação Concluída</p>
              <div className="flex justify-center gap-6">
                <div>
                  <p className="text-2xl font-bold text-primary">{importResult.success}</p>
                  <p className="text-xs text-muted-foreground">Linhas processadas</p>
                </div>
                {importResult.errors > 0 && (
                  <div>
                    <p className="text-2xl font-bold text-destructive">{importResult.errors}</p>
                    <p className="text-xs text-muted-foreground">Avisos/Erros</p>
                  </div>
                )}
              </div>
              {importResult.details && (
                <div className="text-left bg-muted/50 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <p className="text-xs text-muted-foreground whitespace-pre-line">{importResult.details}</p>
                </div>
              )}
              <Button onClick={() => handleClose(false)}>Fechar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
