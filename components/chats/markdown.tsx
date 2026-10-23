"use client";

import { isValidElement, memo } from "react";
import Markdown, { type Components } from "react-markdown";
import { useHighlightedCode } from "@/hooks/use-highlighted-code";
import { CodeBlock, CodeBlockActions, CodeBlockContent, CodeBlockCopyButton, CodeBlockLine } from "@/components/ui/code-block";

function Fence({ code, language }: { code: string; language: string }) {
  const lines = useHighlightedCode(code, language);
  return <CodeBlock size="sm" className="my-1">
    <CodeBlockActions><CodeBlockCopyButton value={code} /></CodeBlockActions>
    <CodeBlockContent className="max-h-96">{lines.map((line, index) => <CodeBlockLine key={index}>{line}</CodeBlockLine>)}</CodeBlockContent>
  </CodeBlock>;
}

const components: Components = {
  pre({ children }) {
    if (!isValidElement<{ className?: string; children?: unknown }>(children)) return <pre>{children}</pre>;
    const language = /language-([\w-]+)/.exec(children.props.className ?? "")?.[1] ?? "text";
    return <Fence code={String(children.props.children ?? "").replace(/\n$/, "")} language={language} />;
  },
};

export const ChatMarkdown = memo(function ChatMarkdown({ text }: { text: string }) {
  return <div className="min-w-0 space-y-3 text-sm leading-relaxed wrap-break-word [&_h1]:text-xl [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-medium [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:whitespace-pre-wrap [&_a]:underline [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.9em] [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_table]:w-full [&_table]:text-left [&_td]:border-t [&_td]:py-1 [&_th]:py-1">
    <Markdown skipHtml disallowedElements={["img"]} components={components}>{text}</Markdown>
  </div>;
});
