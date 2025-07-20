import { evalite, createScorer } from "evalite";
import type { Message } from "ai";
import { askDeepSearch } from "../src/deep-search";
import { factualityModel } from "../src/models";
import { generateObject } from "ai";
import { z } from "zod";

// Reuse the factuality checker from initial.eval.ts
const checkFactuality = async (opts: {
  question: string;
  groundTruth: string;
  submission: string;
}) => {
  const { object } = await generateObject({
    model: factualityModel,
    prompt: `
      You are comparing a submitted answer to an expert answer on a given question. Here is the data:
      [BEGIN DATA]
      ************
      [Question]: ${opts.question}
      ************
      [Expert]: ${opts.groundTruth}
      ************
      [Submission]: ${opts.submission}
      ************
      [END DATA]

      Compare the factual content of the submitted answer with the expert answer. Ignore any differences in style, grammar, or punctuation.
      The submitted answer may either be a subset or superset of the expert answer, or it may conflict with it. Determine which case applies. Answer the question by selecting one of the following options:
      (A) The submitted answer is a subset of the expert answer and is fully consistent with it.
      (B) The submitted answer is a superset of the expert answer and is fully consistent with it.
      (C) The submitted answer contains all the same details as the expert answer.
      (D) There is a disagreement between the submitted answer and the expert answer.
      (E) The answers differ, but these differences don't matter from the perspective of factuality.
    `,
    schema: z.object({
      answer: z
        .enum(["A", "B", "C", "D", "E"])
        .describe("Your selection."),
      rationale: z
        .string()
        .describe(
          "Why you chose this answer. Be very detailed.",
        ),
    }),
  });

  const scores = {
    A: 0.4,
    B: 0.6,
    C: 1,
    D: 0,
    E: 1,
  };

  return {
    score: scores[object.answer],
    metadata: {
      rationale: object.rationale,
    },
  };
};

const Factuality = createScorer<Message[], string, string>({
  name: "Factuality",
  scorer: async ({ input, expected, output }) => {
    const question = input[0]?.content;
    if (typeof question !== 'string') {
      throw new Error('Invalid input: content must be a string');
    }
    return checkFactuality({
      question,
      groundTruth: expected!,
      submission: output,
    });
  },
});

evalite("Deep Search Web Dev Eval", {
  data: async (): Promise<{ input: Message[]; expected: string }[]> => {
    return [
      // Basic Questions
      {
        input: [
          {
            id: "1",
            role: "user",
            content: "What are the key features introduced in React 19?",
          },
        ],
        expected: `React 19's key features include:
- React Compiler (experimental) for automatic performance optimizations
- Improved hydration error handling and recovery
- New hooks for resource management
- Enhanced server component support
- Improved streaming performance
- Better TypeScript integration`,
      },
      {
        input: [
          {
            id: "2",
            role: "user",
            content: "What is the latest version of Next.js and what are its major improvements?",
          },
        ],
        expected: `Next.js 14's major improvements include:
- Turbopack is now stable for development
- Server Actions are now stable
- Partial Prerendering (experimental)
- Next.js Learn platform updates
- Image optimization improvements
- Enhanced metadata API
- Improved static and dynamic rendering
- Better error handling and debugging`,
      },
      {
        input: [
          {
            id: "3",
            role: "user",
            content: "What are the main differences between Bun and Node.js in terms of performance?",
          },
        ],
        expected: `Key performance differences between Bun and Node.js:
- Bun is significantly faster in startup time (3-4x)
- Bun's built-in bundler is faster than webpack/vite
- Bun's JavaScript runtime is built on JavaScriptCore instead of V8
- Bun has native support for TypeScript, JSX, and Web APIs
- Bun's file I/O operations are generally faster
- Bun includes built-in testing, bundling, and package management`,
      },
      // Multi-hop Questions
      {
        input: [
          {
            id: "4",
            role: "user",
            content: "Compare the build performance improvements in Next.js 14's Turbopack with Vite 5's latest optimizations, and explain how this impacts large-scale React applications using TypeScript.",
          },
        ],
        expected: `Comparison of build performance:

Next.js 14's Turbopack:
- 700x faster updates than webpack
- Native support for RSC and React features
- Optimized for TypeScript with incremental type checking
- Memory-efficient module graph
- Persistent caching across builds

Vite 5's optimizations:
- Enhanced dep pre-bundling
- Improved HMR performance
- Better code splitting
- Reduced memory usage

Impact on large React + TypeScript apps:
- Next.js 14 performs better for full builds due to RSC optimization
- Vite 5 has better initial dev server startup
- Both show significant improvements in TypeScript type checking
- Memory usage is notably better in both compared to webpack
- Turbopack shows better performance for incremental builds
- Vite performs better in traditional SPA scenarios`,
      },
      {
        input: [
          {
            id: "5",
            role: "user",
            content: "How do the latest changes in React's concurrent features affect state management libraries like Redux and Zustand, and what are the recommended patterns for managing server state with these libraries in 2024?",
          },
        ],
        expected: `Impact of React's concurrent features on state management:

Redux:
- New Redux Toolkit patterns for concurrent mode
- Automatic batching improvements
- Selective hydration support
- New middleware patterns for server components

Zustand:
- Native support for concurrent features
- Improved integration with React Suspense
- Better TypeScript inference
- Optimized for server components

Recommended patterns for 2024:
- Use server components for initial state
- Implement selective hydration strategies
- Combine local and server state effectively
- Leverage React Query/SWR for server state
- Use middleware for optimistic updates
- Implement proper error boundaries
- Consider partial hydration patterns

Key considerations:
- Server components require new patterns
- State persistence needs careful handling
- Performance impact of hydration
- TypeScript integration improvements
- Proper suspense boundaries
- Error handling strategies`,
      },
      {
        input: [
          {
            id: "6",
            role: "user",
            content: "Analyze how the adoption of React Server Components has influenced the architecture of popular UI component libraries like Shadcn UI and Material UI, and what this means for application bundle sizes and performance metrics.",
          },
        ],
        expected: `Impact of RSC on UI libraries:

Shadcn UI:
- New server-first component architecture
- Reduced client bundle sizes
- Improved initial page load
- Better accessibility patterns
- Enhanced TypeScript support

Material UI:
- Hybrid rendering support
- Optimized bundle splitting
- Server-side styles optimization
- Improved hydration strategies

Bundle size impact:
- 40-60% reduction in client JS
- Improved tree-shaking
- Better code splitting
- Reduced hydration cost

Performance metrics:
- Improved FCP and LCP
- Better TTI scores
- Reduced CLS
- Enhanced Core Web Vitals

Architectural changes:
- Component-level streaming
- Progressive enhancement
- Partial hydration support
- Better prop management
- Enhanced type safety`,
      },
    ];
  },
  task: async (input) => {
    return askDeepSearch(input);
  },
  scorers: [
    {
      name: "Contains Links",
      description: "Checks if the output contains any markdown links.",
      scorer: ({ output }) => {
        // Regex to match markdown links: [text](url)
        const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/;
        const containsLinks = markdownLinkRegex.test(output);

        return containsLinks ? 1 : 0;
      },
    },
    Factuality,
  ],
}); 