"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Hiển thị câu trả lời của AI (markdown). react-markdown không cho chạy HTML thô nên an toàn với nội dung do AI sinh ra.
// Liên kết mở tab mới, chỉ cho phép http/https/đường dẫn nội bộ.

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: (p) => <p className="leading-relaxed [&:not(:first-child)]:mt-3" {...p} />,
        ul: (p) => <ul className="my-3 list-disc space-y-1 pl-5" {...p} />,
        ol: (p) => <ol className="my-3 list-decimal space-y-1 pl-5" {...p} />,
        h1: (p) => <h3 className="mt-4 mb-2 text-base font-semibold" {...p} />,
        h2: (p) => <h3 className="mt-4 mb-2 text-base font-semibold" {...p} />,
        h3: (p) => <h4 className="mt-3 mb-1.5 text-sm font-semibold" {...p} />,
        strong: (p) => <strong className="font-semibold" {...p} />,
        code: (p) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]" {...p} />,
        a: ({ href, ...p }) => {
          const safe = typeof href === "string" && /^(https?:\/\/|\/)/.test(href);
          return safe ? <a href={href} target="_blank" rel="noreferrer noopener" className="text-primary underline" {...p} /> : <span {...p} />;
        },
        table: (p) => (
          <div className="my-3 overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm" {...p} />
          </div>
        ),
        thead: (p) => <thead className="bg-muted/50 text-xs text-muted-foreground" {...p} />,
        th: (p) => <th className="px-3 py-2 font-medium" {...p} />,
        td: (p) => <td className="border-t px-3 py-2 align-top" {...p} />,
        blockquote: (p) => <blockquote className="my-3 border-l-2 pl-3 text-muted-foreground" {...p} />,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
