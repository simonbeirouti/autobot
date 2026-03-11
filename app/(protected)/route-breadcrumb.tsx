"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { getProtectedBreadcrumbs } from "@/app/(protected)/layout-config";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export function RouteBreadcrumb() {
  const pathname = usePathname();
  const items = getProtectedBreadcrumbs(pathname);

  if (items.length === 0) {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <BreadcrumbItem key={item.href}>
              {isLast ? (
                <BreadcrumbPage>{item.title}</BreadcrumbPage>
              ) : (
                <>
                  <BreadcrumbLink asChild>
                    <Link href={item.href}>{item.title}</Link>
                  </BreadcrumbLink>
                  <BreadcrumbSeparator />
                </>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
