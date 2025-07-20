import { openai } from "@ai-sdk/openai";

export const model = openai("gpt-4o");
export const factualityModel = openai("gpt-4"); 