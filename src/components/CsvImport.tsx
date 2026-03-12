import { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  { value: 'company_name', label: 'Nome da Empresa', required: true },
  { value: 'company_domain', label: 'Domínio' },
  { value: 'company_sector', label: 'Setor' },
  { value: 'company_phone', label: 'Telefone' },
];

const CONTACT_FIELDS = [
  { value: 'contact_name', label: 'Nome do Contato', required: true },
  { value: 'contact_email', label: 'E-mail' },
  { value: 'contact_role', label: 'Cargo' },
  { value: 'contact_lead_source', label: 'Origem do Lead' },
  { value: 'contact_status', label: 'Status' },
];

const DEAL_FIELDS = [
  { value: 'deal_name', label: 'Nome do Negócio', required: true },
  { value: 'deal_value', label: 'Valor' },
  { value: 'deal_stage', label: 'Estágio' },
  { value: 'deal_business_area', label: 'Área de Negócio' },
  { value: 'deal_market', label: 'Mercado' },
  { value: 'deal_contract_type', label: 'Tipo de Contrato' },
  { value: 'deal_scope', label: 'Escopo' },
  { value: 'deal_close_date', label: 'Data de Fechamento' },
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

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function autoDetect(headers: string[]): FieldMapping {
  const map: FieldMapping = {};
  headers.forEach((h, i) => {
    const n = normalize(h);
    // Exact match first
    if (DETECT_MAP[n]) { map[i] = DETECT_MAP[n]; return; }
    // Partial match
    for (const [key, value] of Object.entries(DETECT_MAP)) {
      if (n.includes(key) || key.includes(n)) { map[i] = value; return; }
    }
    // Fallback: if header is just "nome" and entityType context
    if (n === 'nome' || n === 'name') {
      // Will be resolved by context
      map[i] = 'company_name';
    }
    if (n === 'telefone' || n === 'tel') {
      map[i] = 'company_phone';
    }
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
            if (vals.deal_stage) dealRecord.stage = vals.deal_stage;
            if (vals.deal_business_area) dealRecord.business_area = vals.deal_business_area;
            if (vals.deal_market) dealRecord.market = vals.deal_market;
            if (vals.deal_contract_type) dealRecord.contract_type = vals.deal_contract_type;
            if (vals.deal_scope) dealRecord.scope = vals.deal_scope;
            if (vals.deal_close_date) dealRecord.close_date = vals.deal_close_date;
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
    const mapped = Object.values(mapping);
    if (importCompanies && !mapped.includes('company_name')) return false;
    if (importContacts && !mapped.includes('contact_name')) return false;
    if (importDeals && !mapped.includes('deal_name')) return false;
    return importCompanies || importContacts || importDeals;
  }, [mapping, importCompanies, importContacts, importDeals]);

  // Group fields for the mapping UI
  const getFieldsForSelect = () => {
    const items: { value: string; label: string; group?: string }[] = [{ value: '', label: '— Ignorar —' }];
    if (importCompanies) {
      COMPANY_FIELDS.forEach(f => items.push({ ...f, group: 'Empresa' }));
    }
    if (importContacts) {
      CONTACT_FIELDS.forEach(f => items.push({ ...f, group: 'Contato' }));
    }
    if (importDeals) {
      DEAL_FIELDS.forEach(f => items.push({ ...f, group: 'Negócio' }));
    }
    return items;
  };

  const selectFields = getFieldsForSelect();

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
                            <Select value={mapping[i] || ''} onValueChange={(v) => setMapping(prev => ({ ...prev, [i]: v === 'ignore' ? '' : v }))}>
                              <SelectTrigger className="w-52 h-8 text-xs">
                                <SelectValue placeholder="Selecione o campo" />
                              </SelectTrigger>
                              <SelectContent>
                                {selectFields.map(f => (
                                  <SelectItem key={f.value || 'ignore'} value={f.value || 'ignore'}>
                                    {f.group ? `${f.group} → ${f.label}` : f.label}
                                  </SelectItem>
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
                  {!(importCompanies || importContacts || importDeals)
                    ? 'Ative pelo menos uma categoria para importar.'
                    : 'Mapeie os campos obrigatórios: ' +
                      [
                        importCompanies && !Object.values(mapping).includes('company_name') ? '"Nome da Empresa"' : '',
                        importContacts && !Object.values(mapping).includes('contact_name') ? '"Nome do Contato"' : '',
                        importDeals && !Object.values(mapping).includes('deal_name') ? '"Nome do Negócio"' : '',
                      ].filter(Boolean).join(', ')}
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
