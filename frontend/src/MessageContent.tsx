import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = { content: string };

/** Convert common HTML-ish model output to readable Markdown; raw HTML stays disabled. */
export function normalizeAssistantMarkdown(input: string): string {
  return String(input ?? "")
    .replace(/<br\s*\/?>/gi, "  \n")
    .replace(/<\/?p\b[^>]*>/gi, "")
    .replace(/<\/?(?:div|span|strong|em)\b[^>]*>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function MessageContent({ content }: Props) {
  return (
    <div className="message-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {normalizeAssistantMarkdown(content)}
      </ReactMarkdown>
    </div>
  );
}
