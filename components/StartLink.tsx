"use client";

import Link from "next/link";
import { useStartHref } from "@/lib/useStartHref";

/** Link zur im Profil gewählten Startseite (siehe lib/useStartHref.ts). */
export default function StartLink({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <Link href={useStartHref()} className={className}>
      {children}
    </Link>
  );
}
