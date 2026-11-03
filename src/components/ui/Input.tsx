import * as React from "react"
import { cn } from "../../lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-stone-200/80 bg-white/60 backdrop-blur-sm px-3.5 py-2 text-sm font-medium text-stone-900 placeholder:text-stone-400 placeholder:font-normal transition-all duration-200 focus:bg-white focus:outline-none focus:ring-3 focus:ring-indigo-500/15 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
