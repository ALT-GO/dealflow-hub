import { useMemo } from 'react';

type Props = {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
};

export function CircularProgress({ value, size = 120, strokeWidth = 10, label }: Props) {
  const clampedValue = Math.min(100, Math.max(0, value));

  const { color, bgColor } = useMemo(() => {
    if (clampedValue >= 80) return { color: 'hsl(var(--success))', bgColor: 'hsl(var(--success) / 0.15)' };
    if (clampedValue >= 40) return { color: 'hsl(var(--warning))', bgColor: 'hsl(var(--warning) / 0.15)' };
    return { color: 'hsl(var(--destructive))', bgColor: 'hsl(var(--destructive) / 0.15)' };
  }, [clampedValue]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedValue / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={bgColor}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-display font-bold text-foreground">{Math.round(clampedValue)}%</span>
        </div>
      </div>
      {label && <p className="text-xs text-muted-foreground text-center max-w-[140px]">{label}</p>}
    </div>
  );
}
