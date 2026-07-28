"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "总览" },
  { href: "/profile", label: "职业档案" },
  { href: "/resume", label: "简历中心" },
  { href: "/jd", label: "岗位描述" },
  { href: "/strategy", label: "求职策略" },
  { href: "/jobs", label: "岗位库" },
  { href: "/applications", label: "投递工作台" },
  { href: "/evaluation", label: "质量评估" },
  { href: "/settings", label: "设置" },
];

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground",
              active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
