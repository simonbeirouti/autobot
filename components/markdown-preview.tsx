"use client";

type MarkdownPreviewProps = {
  content: string;
  className?: string;
};

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs" key={index}>
          {part.slice(1, -1)}
        </code>
      );
    }

    return part;
  });
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  const lines = content.split("\n");
  const blocks: Array<{ type: "h1" | "h2" | "ol" | "ul" | "p"; lines: string[] }> = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push({ type: "h1", lines: [trimmed.slice(2)] });
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push({ type: "h2", lines: [trimmed.slice(3)] });
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const current = blocks.at(-1);
      if (current?.type === "ol") {
        current.lines.push(trimmed.replace(/^\d+\.\s/, ""));
      } else {
        blocks.push({ type: "ol", lines: [trimmed.replace(/^\d+\.\s/, "")] });
      }
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const current = blocks.at(-1);
      if (current?.type === "ul") {
        current.lines.push(trimmed.slice(2));
      } else {
        blocks.push({ type: "ul", lines: [trimmed.slice(2)] });
      }
      continue;
    }

    const current = blocks.at(-1);
    if (current?.type === "p") {
      current.lines.push(trimmed);
    } else {
      blocks.push({ type: "p", lines: [trimmed] });
    }
  }

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        if (block.type === "h1") {
          return (
            <h1 className="text-lg font-semibold" key={index}>
              {renderInline(block.lines[0])}
            </h1>
          );
        }

        if (block.type === "h2") {
          return (
            <h2 className="mt-4 text-sm font-semibold" key={index}>
              {renderInline(block.lines[0])}
            </h2>
          );
        }

        if (block.type === "ol") {
          return (
            <ol className="mt-2 list-decimal space-y-2 pl-5" key={index}>
              {block.lines.map((line, lineIndex) => (
                <li key={lineIndex}>{renderInline(line)}</li>
              ))}
            </ol>
          );
        }

        if (block.type === "ul") {
          return (
            <ul className="mt-2 list-disc space-y-2 pl-5" key={index}>
              {block.lines.map((line, lineIndex) => (
                <li key={lineIndex}>{renderInline(line)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground" key={index}>
            {renderInline(block.lines.join(" "))}
          </p>
        );
      })}
    </div>
  );
}
