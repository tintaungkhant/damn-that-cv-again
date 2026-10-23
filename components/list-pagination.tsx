import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";

// Server-side lists use fixed 25-row pages.
export function ListPagination({ page, total, href }: { page: number; total: number; href: (page: number) => string }) {
  return <Pagination><PaginationContent>
    {page > 1 && <PaginationItem><PaginationPrevious href={href(page - 1)} /></PaginationItem>}
    {page * 25 < total && <PaginationItem><PaginationNext href={href(page + 1)} /></PaginationItem>}
  </PaginationContent></Pagination>;
}
