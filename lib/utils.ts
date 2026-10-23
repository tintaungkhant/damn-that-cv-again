export { cn } from "cn"

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })
}
