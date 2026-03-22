"use client"

/**
 * Summary: A shadcn/ui-compatible DropdownMenu wrapper built on @base-ui/react's Menu primitive.
 * Exports the same component names used by shadcn (DropdownMenu, DropdownMenuTrigger,
 * DropdownMenuContent, DropdownMenuItem) so the rest of the codebase can import them
 * without knowing the underlying primitive.
 *
 * Dependencies: @base-ui/react (already installed), cn from @/lib/utils
 */
import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { cn } from "@/lib/utils"

// ── Root ───────────────────────────────────────────────────────────────────

interface DropdownMenuProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
  modal?: boolean
}

function DropdownMenu({ open, onOpenChange, children, modal = false }: DropdownMenuProps) {
  return (
    <MenuPrimitive.Root
      open={open}
      onOpenChange={onOpenChange ? (nextOpen) => onOpenChange(nextOpen) : undefined}
      modal={modal}
    >
      {children}
    </MenuPrimitive.Root>
  )
}

// ── Trigger ─────────────────────────────────────────────────────────────────

interface DropdownMenuTriggerProps {
  children: React.ReactElement
  asChild?: boolean
}

function DropdownMenuTrigger({ children, asChild: _asChild }: DropdownMenuTriggerProps) {
  // @base-ui/react MenuTrigger uses render prop to compose with a custom element
  return (
    <MenuPrimitive.Trigger render={children} nativeButton={false} />
  )
}

// ── Content ──────────────────────────────────────────────────────────────────

interface DropdownMenuContentProps {
  children?: React.ReactNode
  className?: string
  align?: "start" | "center" | "end"
  side?: "top" | "bottom" | "left" | "right"
}

function DropdownMenuContent({
  children,
  className,
  align = "start",
  side = "bottom",
}: DropdownMenuContentProps) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner align={align} side={side} sideOffset={4}>
        <MenuPrimitive.Popup
          className={cn(
            "z-50 min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

// ── Item ──────────────────────────────────────────────────────────────────────

interface DropdownMenuItemProps {
  children?: React.ReactNode
  className?: string
  onSelect?: () => void
  disabled?: boolean
}

function DropdownMenuItem({
  children,
  className,
  onSelect,
  disabled,
}: DropdownMenuItemProps) {
  return (
    <MenuPrimitive.Item
      disabled={disabled}
      closeOnClick={true}
      onClick={onSelect}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
    >
      {children}
    </MenuPrimitive.Item>
  )
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
}
