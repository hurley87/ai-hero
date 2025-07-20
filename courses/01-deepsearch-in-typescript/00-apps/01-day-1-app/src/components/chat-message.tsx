import ReactMarkdown, { type Components } from "react-markdown";
import type { Message } from "ai";
import { Search, FileText } from "lucide-react";
import type { BulkCrawlResponse, CrawlErrorResponse, CrawlResponse } from "~/server/scraper";

// Extract MessagePart type from Message
export type MessagePart = NonNullable<Message["parts"]>[number];

interface ToolInvocationBase {
  name: string;
  args: Record<string, unknown>;
}

interface ToolInvocationPartialCall extends ToolInvocationBase {
  state: "partial-call";
  step?: number;
}

interface ToolInvocationCall extends ToolInvocationBase {
  state: "call";
  step?: number;
}

interface ToolInvocationResult extends ToolInvocationBase {
  state: "result";
  step?: number;
  result: unknown;
}

type ToolInvocationType = ToolInvocationPartialCall | ToolInvocationCall | ToolInvocationResult;

interface ChatMessageProps {
  message: Message;
  userName: string;
}

const components: Components = {
  // Override default elements with custom styling
  p: ({ children }) => <p className="mb-4 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-4 list-disc pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 list-decimal pl-4">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  code: ({ className, children, ...props }) => (
    <code className={`${className ?? ""}`} {...props}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded-lg bg-gray-700 p-4">
      {children}
    </pre>
  ),
  a: ({ children, ...props }) => (
    <a
      className="text-blue-400 underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
};

const Markdown = ({ children }: { children: string }) => {
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>;
};

const ToolInvocation = ({ part }: { part: MessagePart }) => {
  if (part.type !== "tool-invocation") return null;

  const toolInvocation = part.toolInvocation as unknown as ToolInvocationType;

  if (toolInvocation.state === "partial-call") {
    if (toolInvocation.name === "searchWeb") {
      return (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-900/20 p-3 text-blue-300">
          <Search className="size-4 animate-spin" />
          <span className="text-sm">Searching for: {(toolInvocation.args as { query: string }).query}...</span>
        </div>
      );
    }
    if (toolInvocation.name === "scrapePages") {
      return (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-900/20 p-3 text-blue-300">
          <FileText className="size-4 animate-spin" />
          <span className="text-sm">Scraping {(toolInvocation.args as { urls: string[] }).urls.length} pages...</span>
        </div>
      );
    }
  }

  if (toolInvocation.state === "call") {
    if (toolInvocation.name === "searchWeb") {
      return (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-900/20 p-3 text-blue-300">
          <Search className="size-4" />
          <span className="text-sm">Searched for: {(toolInvocation.args as { query: string }).query}</span>
        </div>
      );
    }
    if (toolInvocation.name === "scrapePages") {
      return (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-900/20 p-3 text-blue-300">
          <FileText className="size-4" />
          <span className="text-sm">Scraping {(toolInvocation.args as { urls: string[] }).urls.length} pages...</span>
        </div>
      );
    }
  }

  if (toolInvocation.state === "result") {
    if (toolInvocation.name === "searchWeb") {
      const results = toolInvocation.result as Array<{ title: string; link: string; snippet: string }>;
      const isArray = Array.isArray(results);
      const resultCount = isArray ? results.length : 0;

      return (
        <div className="mb-4 rounded-lg bg-green-900/20 p-3">
          <div className="mb-2 flex items-center gap-2 text-green-300">
            <Search className="size-4" />
            <span className="text-sm font-medium">
              Found {resultCount} results for: {(toolInvocation.args as { query: string }).query}
            </span>
          </div>
          {isArray && results.length > 0 && (
            <div className="space-y-2">
              {results.slice(0, 3).map((result, index) => (
                <div key={index} className="rounded bg-green-900/10 p-2 text-sm">
                  <div className="font-medium text-green-200">{result.title}</div>
                  {result.snippet && (
                    <div className="mt-1 text-xs text-green-300/80">
                      {result.snippet.length > 100
                        ? `${result.snippet.slice(0, 100)}...`
                        : result.snippet}
                    </div>
                  )}
                  {result.link && (
                    <a
                      href={result.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-xs text-blue-400 underline"
                    >
                      {result.link}
                    </a>
                  )}
                </div>
              ))}
              {results.length > 3 && (
                <div className="text-xs text-green-300/60">
                  ... and {results.length - 3} more results
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (toolInvocation.name === "scrapePages") {
      const result = toolInvocation.result as BulkCrawlResponse;
      if (!result.success) {
        return (
          <div className="mb-4 rounded-lg bg-red-900/20 p-3">
            <div className="mb-2 flex items-center gap-2 text-red-300">
              <FileText className="size-4" />
              <span className="text-sm font-medium">Failed to scrape pages:</span>
            </div>
            <div className="text-sm text-red-300/80">{(result as { error: string }).error}</div>
          </div>
        );
      }

      return (
        <div className="mb-4 rounded-lg bg-green-900/20 p-3">
          <div className="mb-2 flex items-center gap-2 text-green-300">
            <FileText className="size-4" />
            <span className="text-sm font-medium">
              Successfully scraped {result.results.length} pages
            </span>
          </div>
          <div className="space-y-2">
            {result.results.map((item, index) => (
              <div key={index} className="rounded bg-green-900/10 p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-green-200">{item.url}</span>
                  {item.result.success ? (
                    <span className="text-xs text-green-300">Success</span>
                  ) : (
                    <span className="text-xs text-red-300">Failed</span>
                  )}
                </div>
                {item.result.success ? (
                  <div className="mt-1 text-xs text-green-300/80">
                    {item.result.data.length > 100
                      ? `${item.result.data.slice(0, 100)}...`
                      : item.result.data}
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-red-300/80">
                    {(!item.result.success ? item.result : { error: "" }).error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }
  }

  return null;
};

const MessagePartRenderer = ({ part }: { part: MessagePart }) => {
  switch (part.type) {
    case "text":
      return <Markdown>{part.text}</Markdown>;
    
    case "tool-invocation":
      return <ToolInvocation part={part} />;
    
    // Add cases for other part types as needed
    default:
      return null;
  }
};

export const ChatMessage = ({ message, userName }: ChatMessageProps) => {
  const isAI = message.role === "assistant";

  return (
    <div className="mb-6">
      <div
        className={`rounded-lg p-4 ${
          isAI ? "bg-gray-800 text-gray-300" : "bg-gray-900 text-gray-300"
        }`}
      >
        <p className="mb-2 text-sm font-semibold text-gray-400">
          {isAI ? "AI" : userName}
        </p>

        <div className="prose prose-invert max-w-none">
          {message.parts ? (
            message.parts.map((part, index) => (
              <MessagePartRenderer key={index} part={part} />
            ))
          ) : (
            // Fallback to content if parts is not available
            <Markdown>{message.content}</Markdown>
          )}
        </div>
      </div>
    </div>
  );
};
