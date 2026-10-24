import { FileTextIcon, MessageCircleIcon, MessagesSquareIcon } from "lucide-react";
import type { ChatCategory } from "@/lib/storage/store";

export const chatCategories: Record<ChatCategory, { label: string; title: string; badge: string; description: string; icon: typeof FileTextIcon }> = {
  profile: { label: "Profile chats", title: "Career profile chat", badge: "Profile", description: "Turn rough notes into a confirmed, shared career profile.", icon: MessagesSquareIcon },
  build: { label: "CV chats", title: "Build CV chat", badge: "Build CV", description: "Tailor a CV to one job description.", icon: FileTextIcon },
  general: { label: "General chats", title: "General career chat", badge: "General", description: "Write summaries, letters and proposals from your profile, and update it as you go.", icon: MessageCircleIcon },
};
