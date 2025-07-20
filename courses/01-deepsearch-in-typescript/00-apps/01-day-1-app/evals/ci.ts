import type { Message } from "ai";

export const ciData: { input: Message[]; expected: string }[] = [
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
]; 