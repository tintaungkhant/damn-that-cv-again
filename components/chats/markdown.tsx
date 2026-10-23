import { memo } from "react";
import Markdown from "react-markdown";

export const ChatMarkdown = memo(function ChatMarkdown({ text }: { text: string }) {
  return <div className="min-w-0 space-y-3 text-sm leading-relaxed wrap-break-word [&_h1]:text-xl [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-medium [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:whitespace-pre-wrap [&_a]:underline [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground">
    <Markdown skipHtml disallowedElements={["img"]}>{text}</Markdown>
  </div>;
});
