import { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, ArrowRight, Building2, Users, Briefcase, CheckCircle2, AlertTriangle, Download, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type FieldMapping = Record<number, string>;

interface CsvImportProps {
  entityType: 'companies' | 'contacts' | 'deals';
  onComplete: () => void;
}

interface ImportError {
  row: number;
  entity: string;
  field: string;
  message: string;
}

const COMPANY_FIELDS = [
  { value: 'company_name', label: 'Nome da Empresa' },
  { value: 'company_domain', label: 'Domínio' },
  { value: 'company_sector', label: 'Setor' },
  { value: 'company_phone', label: 'Telefone' },
  { value: 'company_created_at', label: 'Data de Criação (Empresa)' },
  { value: 'company_last_activity_at', label: 'Data Última Atividade (Empresa)' },
];

const CONTACT_FIELDS = [
  { value: 'contact_name', label: 'Nome do Contato' },
  { value: 'contact_email', label: 'E-mail' },
  { value: 'contact_role', label: 'Cargo' },
  { value: 'contact_lead_source', label: 'Origem do Lead' },
  { value: 'contact_status', label: 'Status' },
  { value: 'contact_created_at', label: 'Data de Criação (Contato)' },
  { value: 'contact_last_activity_at', label: 'Data Última Atividade (Contato)' },
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
  { value: 'deal_created_at', label: 'Data de Criação (Negócio)' },
  { value: 'deal_last_activity_at', label: 'Data Última Atividade (Negócio)' },
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
  'criado em': 'deal_created_at', 'data criacao': 'deal_created_at', 'created at': 'deal_created_at', 'data de criacao': 'deal_created_at',
  'ultima atividade': 'deal_last_activity_at', 'data ultima atividade': 'deal_last_activity_at', 'last activity': 'deal_last_activity_at',
  'ultima atividade empresa': 'company_last_activity_at', 'ultima atividade contato': 'contact_last_activity_at',
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

function truncateWords(s: string, maxWords = 10): string {
  const words = s.split(/\s+/);
  if (words.length <= maxWords) return s;
  return words.slice(0, maxWords).join(' ') + '…';
}

function autoDetect(headers: string[]): FieldMapping {
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

/** Try to parse a date string to ISO format (yyyy-mm-dd). Handles:
 * - ISO: 2024-01-15, 2024-01-15T10:00:00
 * - BR: 15/01/2024, 15-01-2024
 * - US: 01/15/2024, 1/15/2024 (when day > 12, detected as US)
 * - Compact: 15012024, 20240115
 * - Written: "15 jan 2024", "January 15, 2024"
 * - Excel serial number
 */
function parseDate(input: string): string | null {
  if (!input?.trim()) return null;
  const s = input.trim();

  // ISO format: 2024-01-15 or 2024-01-15T...
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
    const [y, m, d] = s.substring(0, 10).split('-').map(Number);
    if (y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Compact 8-digit: 15012024 (ddmmyyyy) or 20240115 (yyyymmdd)
  const compactMatch = s.match(/^(\d{8})$/);
  if (compactMatch) {
    const digits = compactMatch[1];
    // Try yyyymmdd first
    const y1 = parseInt(digits.substring(0, 4));
    const m1 = parseInt(digits.substring(4, 6));
    const d1 = parseInt(digits.substring(6, 8));
    if (y1 > 1900 && m1 >= 1 && m1 <= 12 && d1 >= 1 && d1 <= 31) {
      return `${y1}-${String(m1).padStart(2, '0')}-${String(d1).padStart(2, '0')}`;
    }
    // Try ddmmyyyy
    const d2 = parseInt(digits.substring(0, 2));
    const m2 = parseInt(digits.substring(2, 4));
    const y2 = parseInt(digits.substring(4, 8));
    if (y2 > 1900 && m2 >= 1 && m2 <= 12 && d2 >= 1 && d2 <= 31) {
      return `${y2}-${String(m2).padStart(2, '0')}-${String(d2).padStart(2, '0')}`;
    }
  }

  // Separated format: dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, mm/dd/yyyy, etc.
  const sepMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (sepMatch) {
    const a = parseInt(sepMatch[1]);
    const b = parseInt(sepMatch[2]);
    const y = parseInt(sepMatch[3]);
    if (y > 1900) {
      // If first number > 12, it must be a day (BR: dd/mm/yyyy)
      if (a > 12 && b >= 1 && b <= 12) {
        return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
      }
      // If second number > 12, it must be a day (US: mm/dd/yyyy)
      if (b > 12 && a >= 1 && a <= 12) {
        return `${y}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
      }
      // Ambiguous (both <= 12): default to dd/mm/yyyy (BR convention)
      if (a >= 1 && a <= 31 && b >= 1 && b <= 12) {
        return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
      }
    }
  }

  // yyyy/mm/dd or yyyy.mm.dd
  const ymdSep = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymdSep) {
    const y = parseInt(ymdSep[1]);
    const m = parseInt(ymdSep[2]);
    const d = parseInt(ymdSep[3]);
    if (y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Excel serial number (e.g. 45302 = a date after 1900)
  const numVal = Number(s);
  if (!isNaN(numVal) && numVal > 30000 && numVal < 100000) {
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + numVal * 86400000);
    if (!isNaN(d.getTime())) {
      return d.toISOString().substring(0, 10);
    }
  }

  // Written dates: "15 jan 2024", "January 15, 2024", "jan 15 2024"
  const monthMap: Record<string, string> = {
    jan: '01', janeiro: '01', january: '01', feb: '02', fev: '02', fevereiro: '02', february: '02',
    mar: '03', marco: '03', março: '03', march: '03', apr: '04', abr: '04', abril: '04', april: '04',
    may: '05', mai: '05', maio: '05', jun: '06', junho: '06', june: '06',
    jul: '07', julho: '07', july: '07', aug: '08', ago: '08', agosto: '08', august: '08',
    sep: '09', set: '09', setembro: '09', september: '09', oct: '10', out: '10', outubro: '10', october: '10',
    nov: '11', novembro: '11', november: '11', dec: '12', dez: '12', dezembro: '12', december: '12',
  };
  const norm = s.toLowerCase().replace(/[,\.]/g, ' ').replace(/\s+/g, ' ').trim();
  // "15 jan 2024" or "jan 15 2024"
  const writtenMatch = norm.match(/^(\d{1,2})\s+([a-zçã]+)\s+(\d{4})$/) || norm.match(/^([a-zçã]+)\s+(\d{1,2})\s+(\d{4})$/);
  if (writtenMatch) {
    let dayStr: string, monthStr: string, yearStr: string;
    if (/^\d/.test(writtenMatch[1])) {
      dayStr = writtenMatch[1]; monthStr = writtenMatch[2]; yearStr = writtenMatch[3];
    } else {
      monthStr = writtenMatch[1]; dayStr = writtenMatch[2]; yearStr = writtenMatch[3];
    }
    const mNum = monthMap[monthStr];
    if (mNum) {
      return `${yearStr}-${mNum}-${dayStr.padStart(2, '0')}`;
    }
  }

  // Fallback: Date.parse
  const d = new Date(s);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1900) return d.toISOString().substring(0, 10);
  return null;
}

function generateErrorsPDF(errors: ImportError[]) {
  // Build HTML content for PDF
  const rows = errors.map((e, i) => `
    <tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:6px 8px;font-size:12px;">${i + 1}</td>
      <td style="padding:6px 8px;font-size:12px;">Linha ${e.row}</td>
      <td style="padding:6px 8px;font-size:12px;">${e.entity}</td>
      <td style="padding:6px 8px;font-size:12px;">${e.field}</td>
      <td style="padding:6px 8px;font-size:12px;">${e.message}</td>
    </tr>
  `).join('');

  const html = `
    <html>
    <head>
      <title>Relatório de Erros - Importação</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #1a1a1a; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        p { font-size: 12px; color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f3f4f6; padding: 8px; font-size: 11px; text-transform: uppercase; text-align: left; border-bottom: 2px solid #d1d5db; }
        tr:nth-child(even) { background: #f9fafb; }
      </style>
    </head>
    <body>
      <h1>Relatório de Erros da Importação</h1>
      <p>Total de erros: ${errors.length} — Gerado em ${new Date().toLocaleString('pt-BR')}</p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Linha</th>
            <th>Entidade</th>
            <th>Campo</th>
            <th>Motivo</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (w) {
    w.onload = () => {
      setTimeout(() => { w.print(); URL.revokeObjectURL(url); }, 300);
    };
  }
}

export function CsvImport({ entityType, onComplete }: CsvImportProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'map' | 'duplicates' | 'importing' | 'done'>('upload');
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [importResult, setImportResult] = useState({ success: 0, errors: 0 });
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Duplicate detection state
  type DuplicateItem = { row: number; type: 'company' | 'contact' | 'deal'; name: string; existingInfo: string; action: 'skip' | 'import' };
  const [duplicates, setDuplicates] = useState<DuplicateItem[]>([]);

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

  // Scan for duplicates before importing
  const handleCheckDuplicates = async () => {
    if (!user) return;

    // Extract all values from rows
    const allVals = rows.map(row => {
      const vals: Record<string, string> = {};
      Object.entries(mapping).forEach(([colIdx, field]) => {
        if (field && row[Number(colIdx)]) vals[field] = row[Number(colIdx)];
      });
      return vals;
    });

    // Fetch existing data
    const { data: existingCompanies } = await supabase.from('companies').select('id, name');
    const companyNames = new Set((existingCompanies || []).map(c => c.name.toLowerCase()));

    const { data: existingContacts } = await supabase.from('contacts').select('id, name, email, company_id, companies(name)');
    const contactKeys = new Set((existingContacts || []).map((c: any) => `${c.name?.toLowerCase()}|${c.companies?.name?.toLowerCase() || ''}`));

    const { data: existingDeals } = await supabase.from('deals').select('id, name, company_id, companies(name)');
    const dealKeys = new Set((existingDeals || []).map((d: any) => `${d.name?.toLowerCase()}|${d.companies?.name?.toLowerCase() || ''}`));

    const found: DuplicateItem[] = [];
    const seenInFile = { companies: new Set<string>(), contacts: new Set<string>(), deals: new Set<string>() };

    allVals.forEach((vals, ri) => {
      const rowNum = ri + 2;

      // Check company duplicates
      if (importCompanies && vals.company_name) {
        const key = vals.company_name.toLowerCase();
        if (companyNames.has(key)) {
          found.push({ row: rowNum, type: 'company', name: vals.company_name, existingInfo: 'Empresa já cadastrada no sistema', action: 'skip' });
        } else if (seenInFile.companies.has(key)) {
          found.push({ row: rowNum, type: 'company', name: vals.company_name, existingInfo: 'Duplicada nesta planilha', action: 'skip' });
        }
        seenInFile.companies.add(key);
      }

      // Check contact duplicates
      if (importContacts && vals.contact_name) {
        const companyName = vals.company_name || '';
        const key = `${vals.contact_name.toLowerCase()}|${companyName.toLowerCase()}`;
        if (contactKeys.has(key)) {
          found.push({ row: rowNum, type: 'contact', name: vals.contact_name, existingInfo: `Contato já cadastrado${companyName ? ` na empresa "${companyName}"` : ''}`, action: 'skip' });
        } else if (seenInFile.contacts.has(key)) {
          found.push({ row: rowNum, type: 'contact', name: vals.contact_name, existingInfo: 'Duplicado nesta planilha', action: 'skip' });
        }
        seenInFile.contacts.add(key);
      }

      // Check deal duplicates
      if (importDeals && vals.deal_name) {
        const companyName = vals.company_name || '';
        const key = `${vals.deal_name.toLowerCase()}|${companyName.toLowerCase()}`;
        if (dealKeys.has(key)) {
          found.push({ row: rowNum, type: 'deal', name: vals.deal_name, existingInfo: `Negócio já cadastrado${companyName ? ` na empresa "${companyName}"` : ''}`, action: 'skip' });
        } else if (seenInFile.deals.has(key)) {
          found.push({ row: rowNum, type: 'deal', name: vals.deal_name, existingInfo: 'Duplicado nesta planilha', action: 'skip' });
        }
        seenInFile.deals.add(key);
      }
    });

    if (found.length > 0) {
      setDuplicates(found);
      setStep('duplicates');
    } else {
      handleImport();
    }
  };

  // Build skip sets from duplicate decisions
  const getSkipSets = () => {
    const skipCompanies = new Set<string>();
    const skipContacts = new Set<string>();
    const skipDeals = new Set<string>();
    duplicates.forEach(d => {
      if (d.action === 'skip') {
        const key = `${d.row}`;
        if (d.type === 'company') skipCompanies.add(key);
        if (d.type === 'contact') skipContacts.add(key);
        if (d.type === 'deal') skipDeals.add(key);
      }
    });
    return { skipCompanies, skipContacts, skipDeals };
  };

  const handleImport = async () => {
    if (!user) return;
    setStep('importing');
    let success = 0;
    const allErrors: ImportError[] = [];
    const { skipCompanies, skipContacts, skipDeals } = getSkipSets();

    // Build company cache
    const { data: existingCompanies } = await supabase.from('companies').select('id, name');
    const companyMap = new Map<string, string>((existingCompanies || []).map(c => [c.name.toLowerCase(), c.id]));

    // Build funnel stages cache for stage matching
    const { data: funnelStages } = await supabase.from('funnel_stages').select('key, label').order('sort_order');
    const stageList = funnelStages || [];
    const resolveStage = (input: string | undefined): string => {
      if (!input?.trim()) return 'appointmentscheduled';
      const n = normalize(input);
      const byLabel = stageList.find(s => normalize(s.label) === n);
      if (byLabel) return byLabel.key;
      const byKey = stageList.find(s => s.key === n);
      if (byKey) return byKey.key;
      const partial = stageList.find(s => normalize(s.label).includes(n) || n.includes(normalize(s.label)));
      if (partial) return partial.key;
      return 'appointmentscheduled';
    };

    // Build profiles cache for owner/orcamentista matching
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name');
    const profileList = profiles || [];
    const resolveUser = (input: string | undefined): string | null => {
      if (!input?.trim()) return null;
      const n = normalize(input);
      const exact = profileList.find(p => p.full_name && normalize(p.full_name) === n);
      if (exact) return exact.user_id;
      const partial = profileList.find(p => p.full_name && (normalize(p.full_name).includes(n) || n.includes(normalize(p.full_name))));
      if (partial) return partial.user_id;
      const byEmail = profileList.find(p => p.full_name && p.full_name.toLowerCase() === input.trim().toLowerCase());
      if (byEmail) return byEmail.user_id;
      return null;
    };

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const rowNum = ri + 2;
      let rowHasError = false;

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
          const shouldSkipCompany = skipCompanies.has(`${rowNum}`);
          if (existing) {
            companyId = existing;
          } else if (shouldSkipCompany) {
            // Marked as skip by user — still use existing if found, otherwise skip creation
            companyId = companyMap.get(vals.company_name.toLowerCase()) || null;
          } else {
            const companyRecord: any = {
              name: vals.company_name,
              created_by: user.id,
            };
            if (vals.company_domain) companyRecord.domain = vals.company_domain;
            if (vals.company_sector) companyRecord.sector = vals.company_sector;
            if (vals.company_phone) companyRecord.phone = vals.company_phone;
            if (vals.company_created_at) {
              const d = parseDate(vals.company_created_at);
              if (d) companyRecord.created_at = d;
              else allErrors.push({ row: rowNum, entity: 'Empresa', field: 'Data de Criação', message: `Formato de data inválido: "${vals.company_created_at}"` });
            }
            if (vals.company_last_activity_at) {
              const d = parseDate(vals.company_last_activity_at);
              if (d) companyRecord.last_activity_at = d;
              else allErrors.push({ row: rowNum, entity: 'Empresa', field: 'Última Atividade', message: `Formato de data inválido: "${vals.company_last_activity_at}"` });
            }
            const { data: newC, error: cErr } = await supabase.from('companies').insert(companyRecord).select('id').single();
            if (cErr) {
              rowHasError = true;
              allErrors.push({ row: rowNum, entity: 'Empresa', field: 'Nome', message: `Erro ao inserir empresa "${vals.company_name}": ${cErr.message}` });
            } else if (newC) {
              companyId = newC.id;
              companyMap.set(vals.company_name.toLowerCase(), newC.id);
            }
          }
        } else if (vals.company_name) {
          companyId = companyMap.get(vals.company_name.toLowerCase()) || null;
        }

        // 2. Import Contact
        let contactId: string | null = null;
        const shouldSkipContact = skipContacts.has(`${rowNum}`);
        if (importContacts && vals.contact_name && !shouldSkipContact) {
          if (!companyId) {
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
            if (vals.contact_created_at) {
              const d = parseDate(vals.contact_created_at);
              if (d) contactRecord.created_at = d;
              else allErrors.push({ row: rowNum, entity: 'Contato', field: 'Data de Criação', message: `Formato de data inválido: "${vals.contact_created_at}"` });
            }
            if (vals.contact_last_activity_at) {
              const d = parseDate(vals.contact_last_activity_at);
              if (d) contactRecord.last_activity_at = d;
              else allErrors.push({ row: rowNum, entity: 'Contato', field: 'Última Atividade', message: `Formato de data inválido: "${vals.contact_last_activity_at}"` });
            }
            const { data: newContact, error: ctErr } = await supabase.from('contacts').insert(contactRecord).select('id').single();
            if (ctErr) {
              rowHasError = true;
              allErrors.push({ row: rowNum, entity: 'Contato', field: 'Nome', message: `Erro ao inserir contato "${vals.contact_name}": ${ctErr.message}` });
            } else if (newContact) {
              contactId = newContact.id;
            }
          } else {
            rowHasError = true;
            allErrors.push({ row: rowNum, entity: 'Contato', field: 'Empresa', message: `Contato "${vals.contact_name}" sem empresa vinculada. É necessário mapear o campo "Nome da Empresa".` });
          }
        }

        // 3. Import Deal
        const shouldSkipDeal = skipDeals.has(`${rowNum}`);
        if (importDeals && vals.deal_name && !shouldSkipDeal) {
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
              if (isNaN(parsed)) {
                allErrors.push({ row: rowNum, entity: 'Negócio', field: 'Valor', message: `Valor inválido: "${vals.deal_value}". Usando 0.` });
                dealRecord.value = 0;
              } else {
                dealRecord.value = parsed;
              }
            }
            dealRecord.stage = resolveStage(vals.deal_stage);

            if (vals.deal_business_area) dealRecord.business_area = vals.deal_business_area;
            if (vals.deal_market) dealRecord.market = vals.deal_market;
            if (vals.deal_contract_type) dealRecord.contract_type = vals.deal_contract_type;
            if (vals.deal_scope) dealRecord.scope = vals.deal_scope;
            
            // Date fields with validation
            const dateFields = [
              { key: 'deal_close_date', db: 'close_date', label: 'Data de Fechamento' },
              { key: 'deal_target_delivery_date', db: 'target_delivery_date', label: 'Data de Entrega Alvo' },
              { key: 'deal_proposal_delivery_date', db: 'proposal_delivery_date', label: 'Data Entrega Proposta' },
              { key: 'deal_budget_start_date', db: 'budget_start_date', label: 'Data Início Orçamento' },
            ];
            for (const df of dateFields) {
              if (vals[df.key]) {
                const d = parseDate(vals[df.key]);
                if (d) dealRecord[df.db] = d;
                else allErrors.push({ row: rowNum, entity: 'Negócio', field: df.label, message: `Formato de data inválido: "${vals[df.key]}"` });
              }
            }

            if (vals.deal_created_at) {
              const d = parseDate(vals.deal_created_at);
              if (d) dealRecord.created_at = d;
              else allErrors.push({ row: rowNum, entity: 'Negócio', field: 'Data de Criação', message: `Formato de data inválido: "${vals.deal_created_at}"` });
            }
            if (vals.deal_last_activity_at) {
              const d = parseDate(vals.deal_last_activity_at);
              if (d) dealRecord.last_activity_at = d;
              else allErrors.push({ row: rowNum, entity: 'Negócio', field: 'Última Atividade', message: `Formato de data inválido: "${vals.deal_last_activity_at}"` });
            }

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
              else allErrors.push({ row: rowNum, entity: 'Negócio', field: 'Margem de Lucro', message: `Valor inválido: "${vals.deal_profit_margin}"` });
            }
            if (vals.deal_carbono_zero !== undefined) dealRecord.carbono_zero = parseBool(vals.deal_carbono_zero);
            if (vals.deal_cortex !== undefined) dealRecord.cortex = parseBool(vals.deal_cortex);
            const resolvedOwner = resolveUser(vals.deal_owner);
            if (resolvedOwner) dealRecord.owner_id = resolvedOwner;
            else if (vals.deal_owner) allErrors.push({ row: rowNum, entity: 'Negócio', field: 'Proprietário', message: `Usuário não encontrado: "${vals.deal_owner}". Usando o usuário atual.` });
            const resolvedOrc = resolveUser(vals.deal_orcamentista);
            if (resolvedOrc) dealRecord.orcamentista_id = resolvedOrc;
            else if (vals.deal_orcamentista) allErrors.push({ row: rowNum, entity: 'Negócio', field: 'Orçamentista', message: `Usuário não encontrado: "${vals.deal_orcamentista}".` });
            const { error: dErr } = await supabase.from('deals').insert(dealRecord);
            if (dErr) {
              rowHasError = true;
              allErrors.push({ row: rowNum, entity: 'Negócio', field: 'Inserção', message: `Erro ao inserir negócio "${vals.deal_name}": ${dErr.message}` });
            }
          } else {
            rowHasError = true;
            allErrors.push({ row: rowNum, entity: 'Negócio', field: 'Empresa', message: `Negócio "${vals.deal_name}" sem empresa vinculada. É necessário mapear o campo "Nome da Empresa".` });
          }
        }

        const hasEntity = (importCompanies && vals.company_name) || (importContacts && vals.contact_name) || (importDeals && vals.deal_name);
        if (hasEntity && !rowHasError) success++;
      } catch (err: any) {
        allErrors.push({ row: rowNum, entity: 'Geral', field: '-', message: `Erro inesperado: ${err?.message || 'desconhecido'}` });
      }
    }

    setImportErrors(allErrors);
    setImportResult({ success, errors: allErrors.filter(e => e.field === 'Inserção' || e.field === 'Nome' || e.field === 'Empresa' || e.field === '-').length });
    setStep('done');
  };

  const reset = () => {
    setStep('upload');
    setRows([]);
    setHeaders([]);
    setMapping({});
    setImportResult({ success: 0, errors: 0 });
    setImportErrors([]);
    setDuplicates([]);
    setImportCompanies(true);
    setImportContacts(entityType === 'contacts' || entityType === 'deals');
    setImportDeals(entityType === 'deals');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = (o: boolean) => {
    if (!o) { reset(); onComplete(); }
    setOpen(o);
  };

  const canImport = useMemo(() => {
    return importCompanies || importContacts || importDeals;
  }, [importCompanies, importContacts, importDeals]);

  const similarity = (a: string, b: string): number => {
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb) return 100;
    if (nb.includes(na) || na.includes(nb)) return 80;
    const wordsA = na.split(/\s+/);
    const wordsB = nb.split(/\s+/);
    let common = 0;
    for (const w of wordsA) {
      if (w.length < 2) continue;
      if (wordsB.some(wb => wb.includes(w) || w.includes(wb))) common++;
    }
    if (common > 0) return 30 + common * 20;
    let overlap = 0;
    for (let i = 0; i < Math.min(na.length, nb.length); i++) {
      if (na[i] === nb[i]) overlap++;
    }
    return Math.round((overlap / Math.max(na.length, nb.length)) * 30);
  };

  const getFieldsForHeader = (headerText: string) => {
    const groups = [
      { key: 'Empresa', fields: COMPANY_FIELDS },
      { key: 'Contato', fields: CONTACT_FIELDS },
      { key: 'Negócio', fields: DEAL_FIELDS },
    ];

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
        <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto">
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

              {/* Mapped fields count */}
              <p className="text-xs text-muted-foreground">
                {Object.values(mapping).filter(v => v).length} campo(s) mapeado(s). Vincule as colunas da planilha aos campos do sistema abaixo.
              </p>

              {/* Vertical field mapping list */}
              <div className="border rounded-lg divide-y max-h-[45vh] overflow-y-auto">
                {headers.map((h, i) => {
                  const category = mapping[i]?.startsWith('company_') ? 'company'
                    : mapping[i]?.startsWith('contact_') ? 'contact'
                    : mapping[i]?.startsWith('deal_') ? 'deal' : null;
                  const catColor = category === 'company' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    : category === 'contact' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : category === 'deal' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                    : '';
                  const catLabel = category === 'company' ? 'Empresa' : category === 'contact' ? 'Contato' : category === 'deal' ? 'Negócio' : '';
                  const samples = rows.slice(0, 2).map(r => r[i]).filter(Boolean);

                  return (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate" title={h}>{truncateWords(h)}</p>
                        {samples.length > 0 && (
                          <p className="text-[11px] text-muted-foreground truncate" title={samples.join(' | ')}>
                            ex: {samples.map(s => truncateWords(s)).join(' | ')}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="flex items-center gap-1.5 shrink-0">
                        {category && <Badge className={`text-[9px] px-1.5 ${catColor}`}>{catLabel}</Badge>}
                        <Select value={mapping[i] || 'ignore'} onValueChange={(v) => setMapping(prev => ({ ...prev, [i]: v === 'ignore' ? '' : v }))}>
                          <SelectTrigger className="h-8 w-48 text-xs border-dashed">
                            <SelectValue placeholder="— Ignorar —" />
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
                    </div>
                  );
                })}
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
            <div className="py-6 space-y-5">
              <div className="text-center space-y-3">
                <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
                <p className="text-lg font-bold text-foreground">Importação Concluída</p>
                <div className="flex justify-center gap-6">
                  <div>
                    <p className="text-2xl font-bold text-primary">{importResult.success}</p>
                    <p className="text-xs text-muted-foreground">Importados com sucesso</p>
                  </div>
                  {importErrors.length > 0 && (
                    <div>
                      <p className="text-2xl font-bold text-destructive">{importErrors.length}</p>
                      <p className="text-xs text-muted-foreground">Avisos/Erros</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Detailed errors */}
              {importErrors.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <p className="text-sm font-semibold text-foreground">Detalhes dos erros ({importErrors.length})</p>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => generateErrorsPDF(importErrors)}>
                      <Download className="h-3.5 w-3.5" />
                      Exportar PDF
                    </Button>
                  </div>
                  <ScrollArea className="h-[300px] border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-16">Linha</TableHead>
                          <TableHead className="text-xs w-24">Entidade</TableHead>
                          <TableHead className="text-xs w-28">Campo</TableHead>
                          <TableHead className="text-xs">Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importErrors.map((err, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-medium">{err.row}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className="text-[10px]">{err.entity}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{err.field}</TableCell>
                            <TableCell className="text-xs text-muted-foreground break-words">{err.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}

              <div className="flex justify-center">
                <Button onClick={() => handleClose(false)}>Fechar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
