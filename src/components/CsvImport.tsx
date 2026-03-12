import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type FieldMapping = Record<number, string>;

interface CsvImportProps {
  entityType: 'companies' | 'contacts' | 'deals';
  onComplete: () => void;
}

const COMPANY_FIELDS = [
  { value: '', label: '— Ignorar —' },
  { value: 'name', label: 'Nome' },
  { value: 'domain', label: 'Domínio' },
  { value: 'sector', label: 'Setor' },
  { value: 'phone', label: 'Telefone' },
];

const CONTACT_FIELDS = [
  { value: '', label: '— Ignorar —' },
  { value: 'name', label: 'Nome' },
  { value: 'email', label: 'E-mail' },
  { value: 'role', label: 'Cargo' },
  { value: 'company_name', label: 'Empresa (nome)' },
  { value: 'lead_source', label: 'Origem do Lead' },
  { value: 'status', label: 'Status' },
];

const DEAL_FIELDS = [
  { value: '', label: '— Ignorar —' },
  { value: 'name', label: 'Nome do Negócio' },
  { value: 'company_name', label: 'Empresa (nome)' },
  { value: 'value', label: 'Valor' },
  { value: 'stage', label: 'Estágio' },
  { value: 'business_area', label: 'Área de Negócio' },
  { value: 'market', label: 'Mercado' },
  { value: 'contract_type', label: 'Tipo de Contrato' },
  { value: 'scope', label: 'Escopo' },
  { value: 'close_date', label: 'Data de Fechamento' },
];

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if ((ch === ',' || ch === ';') && !inQuotes) { result.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  });
}

function getFields(entityType: CsvImportProps['entityType']) {
  if (entityType === 'companies') return COMPANY_FIELDS;
  if (entityType === 'contacts') return CONTACT_FIELDS;
  return DEAL_FIELDS;
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
  const [importResult, setImportResult] = useState({ success: 0, errors: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const fields = getFields(entityType);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length < 2) { toast.error('O arquivo precisa ter pelo menos 2 linhas (cabeçalho + dados)'); return; }
      setHeaders(parsed[0]);
      setRows(parsed.slice(1));
      const autoMap: FieldMapping = {};
      parsed[0].forEach((h, i) => {
        const lower = h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const match = fields.find(f => f.value && (lower.includes(f.value) || lower.includes(f.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))));
        if (match) autoMap[i] = match.value;
      });
      setMapping(autoMap);
      setStep('map');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!user) return;
    setStep('importing');
    let success = 0;
    let errors = 0;

    // Cache companies for contacts and deals
    const needsCompanyResolution = entityType === 'contacts' || entityType === 'deals';
    let companyMap = new Map<string, string>();
    if (needsCompanyResolution) {
      const { data: allCompanies } = await supabase.from('companies').select('id, name');
      companyMap = new Map((allCompanies || []).map(c => [c.name.toLowerCase(), c.id]));
    }

    if (entityType === 'companies') {
      for (const row of rows) {
        const record: any = { created_by: user.id };
        Object.entries(mapping).forEach(([colIdx, field]) => {
          if (field && row[Number(colIdx)]) record[field] = row[Number(colIdx)];
        });
        if (!record.name) { errors++; continue; }
        const { error } = await supabase.from('companies').insert(record);
        if (error) errors++; else success++;
      }
    } else if (entityType === 'contacts') {
      for (const row of rows) {
        const record: any = { created_by: user.id };
        let companyName = '';
        Object.entries(mapping).forEach(([colIdx, field]) => {
          if (!field || !row[Number(colIdx)]) return;
          if (field === 'company_name') { companyName = row[Number(colIdx)]; return; }
          record[field] = row[Number(colIdx)];
        });
        if (!record.name) { errors++; continue; }
        let companyId = companyMap.get(companyName.toLowerCase());
        if (!companyId && companyName) {
          const { data: newC } = await supabase.from('companies').insert({ name: companyName, created_by: user.id }).select('id').single();
          if (newC) { companyId = newC.id; companyMap.set(companyName.toLowerCase(), newC.id); }
        }
        if (!companyId) { errors++; continue; }
        record.company_id = companyId;
        const { error } = await supabase.from('contacts').insert(record);
        if (error) errors++; else success++;
      }
    } else {
      // deals
      for (const row of rows) {
        const record: any = { owner_id: user.id };
        let companyName = '';
        Object.entries(mapping).forEach(([colIdx, field]) => {
          if (!field || !row[Number(colIdx)]) return;
          if (field === 'company_name') { companyName = row[Number(colIdx)]; return; }
          if (field === 'value') {
            const parsed = parseFloat(row[Number(colIdx)].replace(/[^\d.,]/g, '').replace(',', '.'));
            record[field] = isNaN(parsed) ? 0 : parsed;
            return;
          }
          record[field] = row[Number(colIdx)];
        });
        if (!record.name) { errors++; continue; }
        let companyId = companyMap.get(companyName.toLowerCase());
        if (!companyId && companyName) {
          const { data: newC } = await supabase.from('companies').insert({ name: companyName, created_by: user.id }).select('id').single();
          if (newC) { companyId = newC.id; companyMap.set(companyName.toLowerCase(), newC.id); }
        }
        if (!companyId) { errors++; continue; }
        record.company_id = companyId;
        const { error } = await supabase.from('deals').insert(record);
        if (error) errors++; else success++;
      }
    }

    setImportResult({ success, errors });
    setStep('done');
  };

  const reset = () => {
    setStep('upload');
    setRows([]);
    setHeaders([]);
    setMapping({});
    setImportResult({ success: 0, errors: 0 });
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = (o: boolean) => {
    if (!o) { reset(); onComplete(); }
    setOpen(o);
  };

  const requiredField = entityType === 'deals' ? 'name' : 'name';

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4 mr-2" />Importar {getEntityLabel(entityType)}
      </Button>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Importar {getEntityLabel(entityType)}
            </DialogTitle>
          </DialogHeader>

          {step === 'upload' && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Faça upload de um arquivo CSV ou TXT com os dados. A primeira linha deve conter os cabeçalhos.
              </p>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" onChange={handleFile} className="hidden" id={`csv-upload-${entityType}`} />
                <label htmlFor={`csv-upload-${entityType}`} className="cursor-pointer space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Clique para selecionar o arquivo</p>
                  <p className="text-xs text-muted-foreground">CSV, TXT (separado por vírgula ou ponto-e-vírgula)</p>
                </label>
              </div>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {rows.length} registros encontrados. Mapeie as colunas do arquivo para os campos do CRM.
              </p>
              <div className="space-y-3">
                {headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm font-medium min-w-32 truncate text-foreground">{h}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Select value={mapping[i] || ''} onValueChange={(v) => setMapping(prev => ({ ...prev, [i]: v }))}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Selecione o campo" />
                      </SelectTrigger>
                      <SelectContent>
                        {fields.map(f => <SelectItem key={f.value} value={f.value || 'ignore'}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="border rounded-lg overflow-x-auto max-h-40">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h, i) => (
                        <TableHead key={i} className="text-xs whitespace-nowrap">{mapping[i] ? fields.find(f => f.value === mapping[i])?.label : h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 3).map((row, ri) => (
                      <TableRow key={ri}>
                        {row.map((cell, ci) => (
                          <TableCell key={ci} className="text-xs whitespace-nowrap">{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={reset}>Voltar</Button>
                <Button onClick={handleImport} disabled={!Object.values(mapping).some(v => v === 'name')}>
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
            <div className="py-8 text-center space-y-3">
              <p className="text-lg font-bold text-foreground">Importação Concluída</p>
              <div className="flex justify-center gap-6">
                <div>
                  <p className="text-2xl font-bold text-primary">{importResult.success}</p>
                  <p className="text-xs text-muted-foreground">Importados</p>
                </div>
                {importResult.errors > 0 && (
                  <div>
                    <p className="text-2xl font-bold text-destructive">{importResult.errors}</p>
                    <p className="text-xs text-muted-foreground">Erros</p>
                  </div>
                )}
              </div>
              <Button onClick={() => handleClose(false)}>Fechar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
