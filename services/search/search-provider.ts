export type SearchProviderInput = {
  query: string;
  city?: string;
  role?: string;
  keywords?: string[];
  limit?: number;
  freshnessDays?: number;
  domains?: string[];
  excludeDomains?: string[];
};

export type SearchProviderResult = {
  title: string;
  url: string;
  snippet: string;
  displayUrl: string;
  sourceName: string;
  publishedAt?: Date | null;
};

export interface SearchProvider {
  name: string;
  search(input: SearchProviderInput): Promise<SearchProviderResult[]>;
}
