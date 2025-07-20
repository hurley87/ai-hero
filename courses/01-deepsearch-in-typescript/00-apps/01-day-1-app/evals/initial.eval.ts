import { evalite } from "evalite";
import type { Message } from "ai";
import { askDeepSearch } from "../src/deep-search";

evalite("Deep Search Eval", {
  data: async (): Promise<{ input: Message[] }[]> => {
    return [
      {
        input: [
          {
            id: "1",
            role: "user",
            content: "What is the latest version of TypeScript?",
          },
        ],
      },
      {
        input: [
          {
            id: "2",
            role: "user",
            content: "What are the main features of Next.js 15?",
          },
        ],
      },
      {
        input: [
          {
            id: "3",
            role: "user",
            content: "Compare React Server Components vs Client Components - what are the key differences?",
          },
        ],
      },
      {
        input: [
          {
            id: "4",
            role: "user",
            content: "What are the best practices for implementing authentication in a Next.js application?",
          },
        ],
      },
      {
        input: [
          {
            id: "5",
            role: "user",
            content: "What is Biome and how does it compare to ESLint and Prettier?",
          },
        ],
      },
      {
        input: [
          {
            id: "6",
            role: "user",
            content: "Explain the benefits and use cases of the new Next.js Partial Prerendering feature.",
          },
        ],
      },
      {
        input: [
          {
            id: "7",
            role: "user",
            content: "What are the main differences between TanStack Query v5 and v4?",
          },
        ],
      },
      {
        input: [
          {
            id: "8",
            role: "user",
            content: "How does Vercel's v0 compare to other UI frameworks like Shadcn UI and Radix UI?",
          },
        ],
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
  ],
}); 