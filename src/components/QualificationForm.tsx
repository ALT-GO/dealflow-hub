import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { QualificationQuestion } from '@/components/settings/QualificationTab';

type Props = {
  questions: QualificationQuestion[];
  answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
};

export function QualificationForm({ questions, answers, onChange }: Props) {
  const activeQuestions = questions.filter(q => q.is_active);
  if (activeQuestions.length === 0) return null;

  return (
    <div className="space-y-3">
      {activeQuestions.map(q => {
        const options = (q.options as { label: string; score: number }[]) || [];
        return (
          <div key={q.id} className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{q.question}</Label>
            <Select value={answers[q.id] || ''} onValueChange={(v) => onChange({ ...answers, [q.id]: v })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt, i) => (
                  <SelectItem key={i} value={opt.label}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}

export function calculateScore(
  questions: QualificationQuestion[],
  answers: Record<string, string>
): number {
  const active = questions.filter(q => q.is_active);
  if (active.length === 0) return 0;

  let totalWeight = 0;
  let weightedScore = 0;

  for (const q of active) {
    const options = (q.options as { label: string; score: number }[]) || [];
    const answer = answers[q.id];
    const matchedOpt = options.find(o => o.label === answer);
    totalWeight += q.weight;
    if (matchedOpt) {
      weightedScore += (matchedOpt.score / 100) * q.weight;
    }
  }

  return totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 0;
}
