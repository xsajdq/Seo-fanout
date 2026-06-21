'use client';

interface Props {
  score: number;
  label: string;
  size?: 'sm' | 'lg';
}

function scoreColor(s: number) {
  if (s >= 75) return { stroke: '#16a34a', text: 'text-green-600' };
  if (s >= 50) return { stroke: '#ca8a04', text: 'text-yellow-600' };
  return { stroke: '#dc2626', text: 'text-red-600' };
}

export default function ScoreRing({ score, label, size = 'sm' }: Props) {
  const r = size === 'lg' ? 44 : 32;
  const cx = size === 'lg' ? 52 : 38;
  const circumference = 2 * Math.PI * r;
  const dash = (score / 100) * circumference;
  const { stroke, text } = scoreColor(score);
  const svgSize = size === 'lg' ? 104 : 76;
  const fontSize = size === 'lg' ? 'text-2xl' : 'text-lg';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: svgSize, height: svgSize }}>
        <svg width={svgSize} height={svgSize} className="-rotate-90">
          <circle
            cx={cx} cy={cx} r={r}
            fill="none" stroke="#e2e8f0" strokeWidth="7"
          />
          <circle
            cx={cx} cy={cx} r={r}
            fill="none" stroke={stroke} strokeWidth="7"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center font-bold ${fontSize} ${text}`}>
          {score}
        </span>
      </div>
      <span className="text-xs text-slate-500 font-medium text-center">{label}</span>
    </div>
  );
}
