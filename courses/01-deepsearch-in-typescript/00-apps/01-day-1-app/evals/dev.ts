import type { Message } from "ai";

export const devData: { input: Message[]; expected: string }[] = [
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
]; 