import * as React from "react"
import { cn } from "../../lib/utils"

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[90px] w-full rounded-xl border border-stone-200/80 bg-white/60 backdrop-blur-sm px-3.5 py-2.5 text-sm font-medium text-stone-900 placeholder:text-stone-400 placeholder:font-normal transition-all duration-200 focus:bg-white focus:outline-none focus:ring-3 focus:ring-indigo-500/15 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
