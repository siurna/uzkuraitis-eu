import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // The trailing `md:text-sm` came from the shadcn template
          // (which shrinks text on desktop because their inputs are
          // form-field-sized). For us the name gate uses this same
          // primitive with override className `text-2xl` — but the
          // base rule was clobbering it at md+, shrinking the name
          // input on desktop. Dropped: now `text-base` is the floor on
          // every breakpoint and any caller's `text-2xl` / etc. wins.
          "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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
