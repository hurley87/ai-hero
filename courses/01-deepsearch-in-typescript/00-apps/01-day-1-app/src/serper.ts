export declare namespace SerperTool {
  export type SearchInput = {
    q: string;
    num: number;
  };

  export interface SearchParameters {
    q: string;
    type: string;
    engine: string;
  }

  export interface KnowledgeGraph {
    title: string;
    type: string;
    rating?: number;
    ratingCount?: number;
    imageUrl?: string;
    attributes?: Record<string, string>;
  }

  export interface Sitelink {
    title: string;
    link: string;
  }

  export interface OrganicResult {
    title: string;
    link: string;
    snippet: string;
    sitelinks?: Sitelink[];
    position: number;
    date?: string;
  }

  export interface PeopleAlsoAskResult {
    question: string;
    snippet: string;
    title: string;
    link: string;
  }

  export interface RelatedSearch {
    query: string;
  }

  export interface SearchResult {
    searchParameters: SearchParameters;
    knowledgeGraph?: KnowledgeGraph;
    organic: OrganicResult[];
    peopleAlsoAsk?: PeopleAlsoAskResult[];
    relatedSearches?: RelatedSearch[];
    credits: number;
  }
}

export const searchSerper = async (
  body: SerperTool.SearchInput,
  signal: AbortSignal | undefined,
): Promise<SerperTool.SearchResult> => {
  if (!process.env.SERPER_API_KEY) {
    throw new Error("SERPER_API_KEY is not set in .env");
  }

  const response = await fetch(`https://google.serper.dev/search`, {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const json = await response.json();

  return json;
};
