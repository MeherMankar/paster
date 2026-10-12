import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Wide tables scroll horizontally inside the article instead of pushing past its edge.
 * `<pre>` already scrolls on its own; everything else wraps via `.prose` styles.
 */
const components: Components = {
  table: ({ node, ...props }) => {
    void node; // hast node, not a DOM attribute
    return (
      <div className="table-wrap">
        <table {...props} />
      </div>
    );
  },
};

/** Sanitized GitHub-flavoured markdown. Raw HTML in the source is not rendered. */
export function MarkdownView({ source }: { source: string }) {
  return (
    <article className="prose mx-auto w-full min-w-0 rounded-lg border border-border bg-surface px-6 py-6 max-sm:rounded-none max-sm:border-x-0 max-sm:px-4 sm:px-10 sm:py-8">
      <Markdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {source}
      </Markdown>
    </article>
  );
}
