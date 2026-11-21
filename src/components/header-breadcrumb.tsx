"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const SECTIONS: Record<string, string> = {
  creators: "Creator",
  products: "Sản phẩm",
  videos: "Video",
  history: "Lịch sử",
  guide: "Hướng dẫn",
  explore: "Thử nghiệm",
};

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Đường dẫn trang hiện tại, ví dụ: Creator / @example.creator. */
export function HeaderBreadcrumb() {
  const segments = usePathname().split("/").filter(Boolean);
  if (segments.length === 0) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Tổng quan</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  const [first, second] = segments;
  const section = SECTIONS[first] ?? first;
  const detail = second ? (first === "creators" ? `@${safeDecode(second)}` : safeDecode(second)) : null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {detail ? (
          <Fragment>
            <BreadcrumbItem className="hidden sm:inline-flex">
              <BreadcrumbLink asChild>
                <Link href={`/${first}`} prefetch={false}>
                  {section}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:block" />
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="truncate">{detail}</BreadcrumbPage>
            </BreadcrumbItem>
          </Fragment>
        ) : (
          <BreadcrumbItem>
            <BreadcrumbPage>{section}</BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
