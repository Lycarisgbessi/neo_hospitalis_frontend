import * as React from "react"
import { cn } from "../../lib/utils"

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'success' | 'teal'
  size?: 'xs' | 'sm' | 'default' | 'lg' | 'xl'
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', loading, onMouseDown, children, ...props }, ref) => {
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
      window.setTimeout(() => ink.remove(), 650)
      onMouseDown?.(e)
    }

    return (
      <button
        ref={ref}
        onMouseDown={handleRipple}
        className={cn(
          "relative overflow-hidden inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-indigo-500/25 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97] select-none",
          {
            "bg-indigo-600 text-white shadow-md hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-600/20": variant === 'default',
            "border border-stone-200 bg-white/80 backdrop-blur text-stone-700 hover:bg-stone-50 hover:border-stone-300 hover:shadow-sm": variant === 'outline',
            "text-stone-500 hover:bg-stone-100/80 hover:text-stone-800": variant === 'ghost',
            "bg-red-600 text-white shadow-md hover:bg-red-500": variant === 'destructive',
            "bg-emerald-600 text-white shadow-md hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-600/20": variant === 'success',
            "bg-teal-600 text-white shadow-md hover:bg-teal-500": variant === 'teal',
          },
          {
            "h-7 px-2.5 text-xs rounded-lg": size === 'xs',
            "h-8 px-3 text-xs rounded-lg": size === 'sm',
            "h-10 px-4 text-sm rounded-xl": size === 'default',
            "h-11 px-6 text-sm rounded-xl": size === 'lg',
            "h-13 px-8 text-base rounded-2xl": size === 'xl',
          },
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-0.5 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
