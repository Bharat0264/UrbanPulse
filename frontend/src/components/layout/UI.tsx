import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, LoaderCircle, TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import { usePreferences } from "../../hooks/context";
export function Panel({
  title,
  eyebrow,
  children,
  action,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={"panel " + className}>
      <header className="panel-heading">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
export function State({
  loading,
  error,
  empty,
  children,
}: {
  loading?: boolean;
  error?: Error | null;
  empty?: boolean;
  children?: ReactNode;
}) {
  if (loading)
    return (
      <div className="state">
        <LoaderCircle className="spin" />
        <p>Reading the city’s pulse…</p>
      </div>
    );
  if (error)
    return (
      <div className="state error" role="alert">
        <TriangleAlert />
        <h3>Data unavailable</h3>
        <p>{error.message}</p>
        <button onClick={() => location.reload()}>Retry connection</button>
      </div>
    );
  if (empty)
    return (
      <div className="state">
        <h3>No trips in this selection</h3>
        <p>Try a wider date range or a different zone.</p>
      </div>
    );
  return <>{children}</>;
}
export function Page({
  eyebrow,
  title,
  description,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const { reduced } = usePreferences();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <header className="page-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>
            {title}
            <span className="cyan">.</span>
          </h1>
          <p>{description}</p>
        </div>
        {action}
      </header>
      {children}
    </motion.div>
  );
}
function Count({ value }: { value: string }) {
  const { reduced } = usePreferences();
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (reduced || !/^\$?[\d,.]+$/.test(value)) {
      setDisplay(value);
      return;
    }
    const target = Number(value.replace(/[$,]/g, ""));
    const digits = value.includes(".") ? value.split(".")[1].length : 0;
    const prefix = value.startsWith("$") ? "$" : "";
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 600);
      setDisplay(
        prefix +
          (target * (1 - Math.pow(1 - progress, 3))).toLocaleString("en-US", {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
          }),
      );
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return <span aria-label={value}>{display}</span>;
}
export function Metric({
  label,
  value,
  unit,
  detail,
}: {
  label: string;
  value: string;
  unit?: string;
  detail: string;
}) {
  return (
    <div className="metric" title={detail}>
      <div className="metric-label">
        {label}
        <ArrowUpRight size={15} />
      </div>
      <div className="metric-value">
        <Count value={value} />
        <small>{unit}</small>
      </div>
      <div className="metric-detail">
        <span /> {detail}
      </div>
    </div>
  );
}
