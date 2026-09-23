import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import styles from "./effects.module.css";

type Props = ComponentProps<"button"> & {
  icon?: ReactNode;
  busy?: boolean;
  size?: "sm" | "md" | "lg";
};
/** Adapted from the supplied ThreeUI glassmorphism CTA: layered glass and rotating border beam. */
export function GlassButton({
  children,
  className,
  icon,
  busy = false,
  disabled,
  size = "md",
  ...props
}: Props) {
  return (
    <button
      {...props}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(styles.glassButton, styles[size], className)}
    >
      <span aria-hidden="true" className={styles.borderBeam} />
      <span aria-hidden="true" className={styles.glassInset} />
      <span className={styles.buttonContent}>
        {busy ? <span className={styles.spinner} aria-hidden="true" /> : icon}
        {children}
      </span>
    </button>
  );
}
