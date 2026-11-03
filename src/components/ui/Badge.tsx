import * as React from "react"
import { cn } from "../../lib/utils"

const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'success' | 'warning' | 'destructive' | 'outline' }>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          {
            "border-transparent bg-slate-900 text-slate-50 hover:bg-slate-900/80": variant === 'default',
            "border-transparent bg-green-100 text-green-800": variant === 'success',
            "border-transparent bg-orange-100 text-orange-800": variant === 'warning',
            "border-transparent bg-red-100 text-red-800": variant === 'destructive',
            "text-slate-950": variant === 'outline',
          },
          className
        )}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge }
