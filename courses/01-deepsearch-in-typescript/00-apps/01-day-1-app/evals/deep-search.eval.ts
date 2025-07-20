import { evalite, createScorer } from "evalite";
import type { Message } from "ai";
import { askDeepSearch } from "../src/deep-search";
import { factualityModel } from "../src/models";
import { generateObject } from "ai";
import { z } from "zod";
import { env } from "../src/env";
import { devData } from "./dev";
import { ciData } from "./ci";
import { regressionData } from "./regression";
import { AnswerRelevancy } from "../src/answer-relevancy-scorer";

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
    let data = [...devData];

    // If CI, add the CI data
    if (env.EVAL_DATASET === "ci") {
      data.push(...ciData);
    // If Regression, add the regression data AND the CI data
    } else if (env.EVAL_DATASET === "regression") {
      data.push(...ciData, ...regressionData);
    }

    return data;
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
    AnswerRelevancy,
  ],
}); 