import { createScorer } from "evalite";
import type { Message } from "ai";
import { checkAnswerRelevancy } from "./answer-relevancy";

export const AnswerRelevancy = createScorer<Message[], string, string>({
  name: "Answer Relevancy",
  scorer: async ({ input, expected, output }) => {
    const question = input[0]?.content;
    if (typeof question !== 'string') {
      throw new Error('Invalid input: content must be a string');
    }
    return checkAnswerRelevancy({
      question,
      submission: output,
    });
  },
}); 