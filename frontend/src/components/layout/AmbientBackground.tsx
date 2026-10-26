export function AmbientBackground({ variant = "dark" }: { variant?: "dark" | "light" }) {
  return <div className={variant === "dark" ? "lb-ambient" : "lb-ambient-light"} aria-hidden />;
}
