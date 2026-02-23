import { z } from "zod";
import { tavilySearchHandler } from "@/app/api/web-search/utils/search_tavily";

// InputSchema - Parámetros que recibe
export const TavilyToolSchema = z.object({
  query: z.string()
    .describe('La consulta de búsqueda.'),

  search_depth: z.enum(['basic', 'advanced'])
    .optional()
    .default('basic')
    .describe('Profundidad de la búsqueda.'),
});

/**
 * Tavily AI search tool definition
 */
export const tavilyToolDefinition = {
  title: 'Tavily AI Search',
  description: 'AI-powered search using Tavily.ai.',
  inputSchema: TavilyToolSchema,
  annotations: {
    readOnlyHint: true,
    openWorldHint: false
  }
};

/**
 * Tavily AI search tool handler
 * @param {z.infer<typeof TavilyToolSchema>} params - The tool parameters
 */
export async function tavilyToolHandler(params: z.infer<typeof TavilyToolSchema>): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  const { query, search_depth = 'basic' } = params;
  console.log(`Searching Tavily AI for: "${query}" (search_depth: ${search_depth || 'default'})`);

  try {
    const response = await tavilySearchHandler({ query, searchDepth: search_depth });
    return response;

  } catch (error: any) {
    console.error(`Error in Tavily AI search: ${error.message}`);
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error searching Tavily AI: ${error.message}`
        }
      ]
    };
  }
}