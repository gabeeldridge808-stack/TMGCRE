export default function Badge({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode;
  variant?: "neutral" | "info" | "warning" | "success" | "danger";
}) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}
