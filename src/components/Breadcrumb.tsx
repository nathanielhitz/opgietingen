import Link from "next/link";
import { Fragment } from "react";

export interface Crumb {
  href?: string;
  label: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Kruimelpad" className="flex flex-wrap items-center gap-1.5 text-sm text-ink-faint">
      <Link href="/" className="hover:text-ember">
        Home
      </Link>
      {items.map((item, i) => (
        <Fragment key={i}>
          <span aria-hidden className="text-ink-faint/60">
            /
          </span>
          {item.href ? (
            <Link href={item.href} className="hover:text-ember">
              {item.label}
            </Link>
          ) : (
            <span className="truncate text-ink-soft">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
