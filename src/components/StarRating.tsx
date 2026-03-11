import { Star } from 'lucide-react';

type Props = {
  score: number; // 0-100
  size?: 'sm' | 'md';
};

export function StarRating({ score, size = 'sm' }: Props) {
  const stars = Math.max(1, Math.min(5, Math.round((score / 100) * 5)));
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <div className="flex items-center gap-0.5" title={`Qualificação: ${stars}/5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`${iconSize} ${i <= stars ? 'text-warning fill-warning' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  );
}

export function scoreToStars(score: number): number {
  return Math.max(1, Math.min(5, Math.round((score / 100) * 5)));
}
