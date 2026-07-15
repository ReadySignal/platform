"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Today's Opportunities" },
  { href: "/import", label: "Import Contacts" },
  { href: "/research", label: "Research Queue" },
  { href: "/companies", label: "Companies" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/import") {
    return pathname === "/import" || pathname.startsWith("/analyze");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNavigation() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/75 px-4 py-3 text-sm shadow-[0_12px_40px_-30px_rgba(15,23,42,0.4)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <Link href="/" className="text-sm font-semibold tracking-tight text-slate-950">
        ReadySignal
      </Link>
      <div className="flex flex-wrap gap-1">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
