import React from "react"
import { cn } from "@/lib/utils"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--status-pending)]"
    
    const variants = {
      default: "bg-[var(--status-pending)] text-[var(--background)] hover:bg-[var(--status-pending)]/90",
      outline: "border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface)]",
      ghost: "text-[var(--foreground)] hover:bg-[var(--surface)]"
    }
    
    const sizes = {
      default: "h-9 px-4 py-2 text-sm",
      icon: "h-9 w-9"
    }
    
    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"

export { Button }
