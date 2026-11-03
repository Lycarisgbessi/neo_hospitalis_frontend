import * as React from "react"
import { cn } from "../../lib/utils"

const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'outline' | 'info' | 'purple'
  dot?: boolean
}>(
  ({ className, variant = 'default', dot, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide transition-colors",
          {
            "bg-stone-900 text-stone-50": variant === 'default',
            "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15": variant === 'success',
            "bg-amber-50 text-amber-700 ring-1 ring-amber-600/15": variant === 'warning',
            "bg-red-50 text-red-700 ring-1 ring-red-600/15": variant === 'destructive',
            "bg-sky-50 text-sky-700 ring-1 ring-sky-600/15": variant === 'info',
            "bg-purple-50 text-purple-700 ring-1 ring-purple-600/15": variant === 'purple',
            "text-stone-600 ring-1 ring-stone-200 bg-white": variant === 'outline',
          },
          className
        )}
        {...props}
      >
        {dot && (
          <span className={cn(
            "w-1.5 h-1.5 rounded-full animate-pulse",
            variant === 'success' && 'bg-emerald-500',
            variant === 'warning' && 'bg-amber-500',
            variant === 'destructive' && 'bg-red-500',
            variant === 'info' && 'bg-sky-500',
            variant === 'default' && 'bg-stone-300',
          )} />
        )}
        {children}
      </div>
    )
  }
)
Badge.displayName = "Badge"

export { Badge }
