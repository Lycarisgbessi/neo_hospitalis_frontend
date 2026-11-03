import * as React from "react"
import { cn } from "../../lib/utils"

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', onMouseDown, ...props }, ref) => {
    // Micro-interaction : encre circulaire au clic (ripple)
    const handleRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
      const el = e.currentTarget
      const rect = el.getBoundingClientRect()
      const d = Math.max(rect.width, rect.height)
      const ink = document.createElement('span')
      ink.className = 'ripple-ink'
      ink.style.width = ink.style.height = `${d}px`
      ink.style.left = `${e.clientX - rect.left - d / 2}px`
      ink.style.top = `${e.clientY - rect.top - d / 2}px`
      el.appendChild(ink)
      window.setTimeout(() => ink.remove(), 700)
      onMouseDown?.(e)
    }

    return (
      <button
        ref={ref}
        onMouseDown={handleRipple}
        className={cn(
          "relative overflow-hidden inline-flex items-center justify-center rounded-md text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
          {
            "bg-blue-600 text-white shadow hover:bg-blue-700": variant === 'default',
            "border border-slate-200 bg-transparent hover:bg-slate-100 text-slate-900": variant === 'outline',
            "hover:bg-slate-100 hover:text-slate-900 text-slate-700": variant === 'ghost',
            "bg-red-500 text-white shadow-sm hover:bg-red-600": variant === 'destructive',
            "h-9 px-4 py-2": size === 'default',
            "h-8 rounded-md px-3 text-xs": size === 'sm',
            "h-10 rounded-md px-8": size === 'lg',
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
