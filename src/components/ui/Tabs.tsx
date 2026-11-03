import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "../../lib/utils"

// Tabs maison avec pastille blanche glissante (micro-interaction refonte DA).

const TabsContext = React.createContext<{ value: string; onValueChange: (value: string) => void; id: string } | null>(null)

const Tabs = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value: string; onValueChange: (value: string) => void }>(
  ({ className, value, onValueChange, children, ...props }, ref) => {
    const id = React.useId()
    return (
      <TabsContext.Provider value={{ value, onValueChange, id }}>
        <div ref={ref} className={cn("w-full", className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    )
  }
)
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("relative inline-flex h-10 items-center justify-center rounded-md bg-slate-100 p-1 text-slate-500", className)} {...props} />
))
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }>(
  ({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    const isActive = value === context?.value;
    return (
      <button
        ref={ref}
        type="button"
        onClick={() => context?.onValueChange(value)}
        className={cn(
          "relative inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          isActive ? "text-slate-950" : "hover:bg-slate-200/50 hover:text-slate-900",
          className
        )}
        {...props}
      >
        {isActive && (
          <motion.span
            layoutId={`tabs-pill-${context?.id ?? ''}`}
            className="absolute inset-0 bg-white rounded-sm shadow-sm"
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          />
        )}
        <span className="relative">{props.children}</span>
      </button>
    )
  }
)
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value: string }>(
  ({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    if (value !== context?.value) return null;
    return (
      <div
        ref={ref}
        className={cn("mt-2 focus-visible:outline-none animate-in fade-in duration-250", className)}
        {...props}
      />
    )
  }
)
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
