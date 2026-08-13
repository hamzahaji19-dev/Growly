import { Sprout } from 'lucide-react'

export function SplashScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface">
      <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-accent-gradient text-white shadow-pop">
        <Sprout className="h-8 w-8" />
      </div>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-containerHigh">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-accent-gradient" />
      </div>
      <p className="text-sm font-medium text-onSurfaceVariant">Growly</p>
    </div>
  )
}
