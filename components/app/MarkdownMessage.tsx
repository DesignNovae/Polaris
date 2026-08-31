"use client";

import React, { useMemo } from "react";
import ReactMarkdown, {
  defaultUrlTransform,
  type Components,
  type Options as ReactMarkdownOptions,
} from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { cn } from "@/lib/cn";
import { normalizeAIResponseMarkdown } from "@/lib/markdown/normalize";

export type CitationSource = {
  label: string;
  uri: string;
  kind: "kb" | "case" | "web" | "profile" | "roadmap";
};

type Props = {
  text: string;
  sources?: CitationSource[];
  theme?: "light" | "dark";
  className?: string;
};

type Theme = NonNullable<Props["theme"]>;
type Citation = CitationSource & { n: number };

const CITATION_PROTOCOL = "polaris-cite:";
const CITE_RX = /<cite>([^<]+?)<\/cite>/gi;
const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins: NonNullable<ReactMarkdownOptions["rehypePlugins"]> = [[
  rehypeKatex,
  {
    throwOnError: false,
    strict: "ignore",
    output: "htmlAndMathml",
    errorColor: "#9f5138",
  },
]];

export function MarkdownMessage({
  text,
  sources = [],
  theme = "light",
  className,
}: Props) {
  const prepared = useMemo(
    () => prepareMarkdown(text, sources),
    [text, sources],
  );
  const components = useMemo(
    () => markdownComponents(theme, prepared.citations),
    [theme, prepared.citations],
  );

  return (
    <div
      className={cn(
        "markdown-body min-w-0 text-[14px] leading-relaxed",
        theme === "dark" ? "text-paper" : "text-ink",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
        skipHtml
        urlTransform={(url) => (
          url.startsWith(CITATION_PROTOCOL) ? url : defaultUrlTransform(url)
        )}
      >
        {prepared.markdown}
      </ReactMarkdown>
    </div>
  );
}

function prepareMarkdown(
  text: string,
  sources: CitationSource[],
): { markdown: string; citations: Citation[] } {
  const citations: Citation[] = [];
  const withCitationLinks = text.replace(CITE_RX, (_match, raw: string) => {
    const value = raw.trim();
    const separator = value.indexOf("|");
    const rawLabel = separator >= 0 ? value.slice(0, separator).trim() : "";
    const rawUri = separator >= 0 ? value.slice(separator + 1).trim() : value;
    const attached = sources.find((source) => (
      source.uri === rawUri || (rawLabel && source.label === rawLabel)
    ));
    const n = citations.length + 1;

    citations.push({
      n,
      label: attached?.label || rawLabel || labelFromUri(rawUri),
      uri: attached?.uri || rawUri,
      kind: attached?.kind || kindFromUri(rawUri),
    });

    return `[${n}](${CITATION_PROTOCOL}${n})`;
  });

  return {
    markdown: normalizeAIResponseMarkdown(withCitationLinks),
    citations,
  };
}

function markdownComponents(theme: Theme, citations: Citation[]): Components {
  const dark = theme === "dark";

  return {
    h1: ({ node: _node, ...props }) => (
      <h2 {...props} className="font-serif text-[19px] font-bold tracking-tight" />
    ),
    h2: ({ node: _node, ...props }) => (
      <h3 {...props} className="text-[16px] font-bold tracking-tight" />
    ),
    h3: ({ node: _node, ...props }) => (
      <h4 {...props} className="text-[14.5px] font-semibold tracking-tight" />
    ),
    h4: ({ node: _node, ...props }) => (
      <h5 {...props} className="text-[14px] font-semibold tracking-tight" />
    ),
    p: ({ node: _node, ...props }) => (
      <p {...props} className="min-w-0 leading-relaxed" />
    ),
    strong: ({ node: _node, ...props }) => (
      <strong {...props} className="font-semibold" />
    ),
    blockquote: ({ node: _node, ...props }) => (
      <blockquote
        {...props}
        className={cn(
          "rounded-r-md border-l-2 py-1 pl-3 text-[13.5px] italic",
          dark
            ? "border-polaris-400/40 bg-white/[0.02] text-paper/80"
            : "border-polaris-500/30 bg-paper-soft/40 text-ink-dim",
        )}
      />
    ),
    ul: ({ node: _node, ...props }) => (
      <ul {...props} className="ml-5 list-disc space-y-1.5 marker:text-polaris-500" />
    ),
    ol: ({ node: _node, ...props }) => (
      <ol
        {...props}
        className="ml-5 list-decimal space-y-1.5 marker:font-semibold marker:text-polaris-500"
      />
    ),
    li: ({ node: _node, ...props }) => (
      <li {...props} className="pl-1 leading-relaxed" />
    ),
    hr: ({ node: _node, ...props }) => (
      <hr
        {...props}
        className={cn(
          "my-3 h-px border-0",
          dark ? "bg-white/10" : "bg-polaris-500/15",
        )}
      />
    ),
    pre: ({ node: _node, ...props }) => (
      <pre
        {...props}
        className={cn(
          "max-w-full overflow-x-auto rounded-lg p-3 font-mono text-[12.5px] leading-relaxed",
          dark
            ? "bg-white/[0.06] text-paper ring-1 ring-inset ring-white/[0.08]"
            : "bg-paper-soft text-ink hairline",
        )}
      />
    ),
    code: ({ node: _node, className: codeClassName, children, ...props }) => {
      const block = Boolean(codeClassName?.includes("language-"))
        || String(children).includes("\n");

      if (block) {
        return (
          <code {...props} className={cn("whitespace-pre", codeClassName)}>
            {children}
          </code>
        );
      }

      return (
        <code
          {...props}
          className={cn(
            "break-words rounded px-1 py-0.5 font-mono text-[12.5px]",
            dark
              ? "bg-white/[0.08] text-polaris-200"
              : "bg-polaris-50 text-polaris-700",
          )}
        >
          {children}
        </code>
      );
    },
    a: ({ node: _node, href = "", children, ...props }) => {
      if (href.startsWith(CITATION_PROTOCOL)) {
        const n = Number.parseInt(href.slice(CITATION_PROTOCOL.length), 10);
        const citation = citations.find((item) => item.n === n);
        return citation
          ? <CitationChip citation={citation} theme={theme} />
          : <span>{children}</span>;
      }

      return (
        <a
          {...props}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "break-words underline underline-offset-2 transition-colors",
            dark
              ? "text-polaris-200 hover:text-polaris-100"
              : "text-polaris-600 hover:text-polaris-700",
          )}
        >
          {children}
        </a>
      );
    },
    table: ({ node: _node, ...props }) => (
      <div className="markdown-table-wrap">
        <table {...props} className="w-full min-w-[420px] border-collapse text-left text-[12.5px]" />
      </div>
    ),
    thead: ({ node: _node, ...props }) => (
      <thead {...props} className={dark ? "bg-white/[0.06]" : "bg-paper-soft"} />
    ),
    th: ({ node: _node, ...props }) => (
      <th
        {...props}
        className={cn(
          "border px-2.5 py-2 font-semibold",
          dark ? "border-white/10" : "border-polaris-500/15",
        )}
      />
    ),
    td: ({ node: _node, ...props }) => (
      <td
        {...props}
        className={cn(
          "border px-2.5 py-2 align-top",
          dark ? "border-white/10" : "border-polaris-500/15",
        )}
      />
    ),
    input: ({ node: _node, ...props }) => (
      <input {...props} disabled className="mr-1.5 accent-polaris-500" />
    ),
    img: ({ node: _node, alt }) => (
      <span className="italic opacity-70">{alt || "Image"}</span>
    ),
  };
}

function CitationChip({
  citation,
  theme,
}: {
  citation: Citation;
  theme: Theme;
}) {
  const classes = cn(
    "mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-md px-1 align-middle font-mono text-[10px] font-semibold ring-1 ring-inset transition-colors",
    theme === "dark"
      ? "bg-polaris-500/15 text-polaris-200 ring-polaris-400/30 hover:bg-polaris-500/25"
      : "bg-polaris-100 text-polaris-700 ring-polaris-300/50 hover:bg-polaris-200",
  );
  const title = `${citation.label} - ${citation.uri}`;

  if (citation.kind === "web" && /^https?:\/\//.test(citation.uri)) {
    return (
      <a
        href={citation.uri}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
        title={title}
      >
        {citation.n}
      </a>
    );
  }

  return (
    <span className={classes} title={title}>
      {citation.n}
    </span>
  );
}

function kindFromUri(uri: string): CitationSource["kind"] {
  // The model sometimes drops the slashes ("kb:cost:germany"). Accept both,
  // or a valid internal citation renders as an external web link.
  if (/^kb:(\/\/)?/.test(uri)) return "kb";
  // me: is a passage retrieved from the student's own material - the id
  // prefix says which surface it came from.
  if (/^me:(\/\/)?(rm|ms):/.test(uri)) return "roadmap";
  if (/^me:(\/\/)?/.test(uri)) return "profile";
  if (uri.startsWith("case://")) return "case";
  if (uri.startsWith("profile://")) return "profile";
  if (uri.startsWith("roadmap://")) return "roadmap";
  return "web";
}

function labelFromUri(uri: string): string {
  if (/^me:(\/\/)?(rm|ms):/.test(uri)) return "Your roadmap";
  if (/^me:(\/\/)?mem:/.test(uri)) return "What Polaris remembers";
  if (/^me:(\/\/)?chat:/.test(uri)) return "Your earlier chat";
  if (uri.startsWith("roadmap://")) return `Milestone ${uri.slice(10)}`;
  if (uri.startsWith("profile://")) return "Your profile";
  if (uri.includes("://") && !uri.startsWith("http")) {
    return uri.slice(uri.indexOf("://") + 3) || "Source";
  }

  try {
    return new URL(uri).hostname.replace(/^www\./, "");
  } catch {
    return uri.slice(0, 40) || "Source";
  }
}
