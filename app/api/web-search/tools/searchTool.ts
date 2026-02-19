import { searchDuckDuckGo } from '@/app/api/web-search/utils/search';
import { z } from "zod";

// InputSchema - Parámetros que recibe
export const SearchToolSchema = z.object({
  query: z.string()
    .describe('Enter your search query to find the most relevant web pages.'),

  numResults: z.number().int()
    .optional()
    .default(3)
    .describe('Specify how many results to display (default: 3, maximum: 20).'),

  mode: z.enum(['short', 'detailed'])
    .optional()
    .default('short')
    .describe("Choose 'short' for basic results (no Description) or 'detailed' for full results (includes Description).")
});

/**
 * Web search tool definition
 */
export const searchToolDefinition = {
  title: 'Web Search',
  description: 'Perform a web search using DuckDuckGo and receive detailed results including titles, URLs, and summaries.',
  inputSchema: SearchToolSchema
};

/**
 * Web search tool handler
 * @param {z.infer<typeof SearchToolSchema>} params - The tool parameters
 * @returns {Promise<Object>} - The tool response
 */
export async function searchToolHandler(params: z.infer<typeof SearchToolSchema>) {
  const { query, numResults = 3, mode = 'short' } = params;
  console.log(`Searching for: ${query} (${numResults} results, mode: ${mode})`);

  const results = await searchDuckDuckGo(query, numResults, mode);
  console.log(`Found ${results.length} results`);

  // Format results as readable text, similar to other search tools
  const formattedResults = results.map((result: any, index: number) => {
    let formatted = `${index + 1}. **${result.title}**\n`;
    formatted += `URL: ${result.url}\n`;

    if (result.displayUrl) {
      formatted += `Display URL: ${result.displayUrl}\n`;
    }

    if (result.snippet) {
      formatted += `Snippet: ${result.snippet}\n`;
    }

    if (mode === 'detailed' && result.description) {
      formatted += `Content: ${result.description}\n`;
    }

    if (result.favicon) {
      formatted += `Favicon: ${result.favicon}\n`;
    }

    return formatted;
  }).join('\n');

  return {
    content: [
      {
        type: 'text' as const,
        text: formattedResults || 'No results found.'
      }
    ]
  };
}
