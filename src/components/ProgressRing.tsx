interface ProgressRingProps {
  value: number // 0-100
  size?: number
  stroke?: number
  trackClassName?: string
  barClassName?: string
  gradient?: boolean
  children?: React.ReactNode
}

export function ProgressRing({
  value,
  size = 64,
  stroke = 7,
  trackClassName = 'text-primary-fixed-dim',
  barClassName = '',
  gradient = true,
  children,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, value))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {gradient && (
          <defs>
            <linearGradient id="ring-accent" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1a4331" />
              <stop offset="55%" stopColor="#3e6752" />
              <stop offset="100%" stopColor="#fea619" />
            </linearGradient>
          </defs>
        )}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={trackClassName}
          stroke="currentColor"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={gradient ? '' : barClassName}
          stroke={gradient ? 'url(#ring-accent)' : 'currentColor'}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}
