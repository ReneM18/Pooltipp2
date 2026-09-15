"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Tipps" },
  { href: "/rangliste", label: "Rangliste" },
  { href: "/shop", label: "Prämien-Shop" },
];

export default function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-edge bg-pitch">
      <div className="mx-auto flex max-w-3xl gap-6 px-5">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative py-3 font-display text-sm font-semibold tracking-wide transition-colors ${
                isActive ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gold" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
