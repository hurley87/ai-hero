import type { Message } from "ai";

export const regressionData: { input: Message[]; expected: string }[] = [
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