import Link from "next/link";
import { Fragment } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

export function PageHeader({ trail, children }: { trail: { label: string; href?: string }[]; children?: React.ReactNode }) {
  return <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
    <SidebarTrigger className="-ml-1" />
    <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList className="flex-nowrap">
        {trail.map((item, index) => <Fragment key={index}>
          {index > 0 && <BreadcrumbSeparator className="hidden sm:block" />}
          <BreadcrumbItem className={index < trail.length - 1 ? "hidden sm:inline-flex" : "min-w-0"}>
            {item.href ? <BreadcrumbLink asChild><Link href={item.href}>{item.label}</Link></BreadcrumbLink> : <BreadcrumbPage className="truncate">{item.label}</BreadcrumbPage>}
          </BreadcrumbItem>
        </Fragment>)}
      </BreadcrumbList>
    </Breadcrumb>
    {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
  </header>;
}
