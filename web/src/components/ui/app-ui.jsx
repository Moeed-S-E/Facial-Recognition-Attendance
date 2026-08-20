import { IconSymbol } from "./icon-symbol";
import { palette } from "../../constants";

export function AppMark({ size = 44 }) {
  return (
    <div className="flex items-center justify-center rounded-[30%] bg-blue shadow-lg shadow-blue/20" style={{ width: size, height: size }} aria-hidden="true">
      <IconSymbol name="faceid" size={size * 0.54} color="#FFFFFF" />
    </div>
  );
}

export function PageTitle({ eyebrow, title, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="ui-kicker mb-2">{eyebrow}</p>}
        <h1 className="text-3xl font-bold tracking-[-0.035em] text-ink sm:text-[34px]">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function FrostedCard({ children, className = "" }) {
  return <div className={`ui-surface ${className}`}>{children}</div>;
}

export function PrimaryButton({ label, onPress, icon, variant = "blue", disabled = false, type = "button", className = "" }) {
  const variants = {
    blue: "bg-blue text-white shadow-[0_8px_20px_rgba(90,169,230,0.18)] hover:bg-cool-sky-2",
    ink: "bg-ink text-white hover:bg-blue-deep",
    light: "border border-line bg-blue-soft text-blue hover:border-blue/40 hover:bg-white",
  };
  const iconColor = variant === "light" ? palette.blue : "#FFFFFF";
  return (
    <button type={type} disabled={disabled} onClick={onPress} className={`ui-focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold transition-[background-color,box-shadow,transform,opacity] duration-200 active:scale-[.985] disabled:pointer-events-none disabled:opacity-45 ${variants[variant]} ${className}`}>
      <span>{label}</span>
      {icon && <IconSymbol name={icon} size={18} color={iconColor} />}
    </button>
  );
}

export function StatusPill({ label, tone = "mint" }) {
  const toneStyles = {
    mint: "bg-mint-soft text-mint",
    amber: "bg-amber-soft text-amber",
    blue: "bg-blue-soft text-blue",
    rose: "bg-rose-soft text-rose",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1.5 text-xs font-bold tracking-wide ${toneStyles[tone]}`}>{label}</span>;
}

export function IconButton({ icon, label, onPress, className = "" }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onPress} className={`ui-focus-ring flex size-11 items-center justify-center rounded-2xl border border-line bg-white text-ink transition-[background-color,box-shadow,transform] duration-180 hover:bg-blue-soft hover:shadow-[0_8px_20px_rgba(90,169,230,0.12)] active:scale-[.985] ${className}`}>
      <IconSymbol name={icon} size={20} color={palette.ink} />
    </button>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-xl bg-line/50 ${className}`} aria-hidden="true" />;
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="ui-surface flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <IconSymbol name={icon} size={26} color={palette.blue} />}
      <h2 className="mt-4 text-base font-bold text-ink">{title}</h2>
      {description && <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SectionDivider() {
  return <div className="ui-divider border-t" aria-hidden="true" />;
}
