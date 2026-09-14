import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/*
 * Boutons en pilule, a la charte de la maquette : le primaire est un aplat
 * neon avec une encre sombre et un halo, jamais du texte clair. Les hauteurs
 * sont relevees par rapport au defaut shadcn — l'app se pilote au doigt, en
 * salle, et le handoff demande 34 px de cible minimum.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[var(--glow-action)] hover:bg-[#5bffb1]",
        outline:
          "border-border-strong text-foreground hover:bg-chip aria-expanded:bg-chip bg-transparent",
        secondary:
          "bg-chip text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--chip),var(--foreground)_6%)] aria-expanded:bg-chip",
        ghost: "text-muted-foreground hover:bg-chip hover:text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_0_24px_rgb(255_45_111/0.3)] hover:bg-[#ff5b8c]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-[34px] gap-1 px-3.5 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-5 text-[15px] font-extrabold",
        icon: "size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-[34px]",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
