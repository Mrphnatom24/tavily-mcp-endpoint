import { searchIAsk, VALID_MODES, VALID_DETAIL_LEVELS } from '@/app/api/web-search/utils/search_iask';
import { z } from "zod";


// InputSchema - Parámetros que recibe
export const IAskToolSchema = z.object({
  query: z.string()
    .describe('The search query or question to ask. Supports natural language questions.'),

  mode: z.enum(VALID_MODES)
    .default('question')
    .describe('Search mode: "question", "academic", "forums", "wiki", or "thinking".'),

  detailLevel: z.enum(VALID_DETAIL_LEVELS)
    .optional().default('concise')
    .describe('Level of detail: "concise", "detailed", or "comprehensive".')
});

/**
 * IAsk AI search tool definition
 */
export const iaskToolDefinition = {
  title: 'IAsk AI Search',
  description: 'AI-powered search using IAsk.ai. Retrieves comprehensive, AI-generated responses based on web content. Supports different search modes (question, academic, forums, wiki, thinking) and detail levels (concise, detailed, comprehensive). Ideal for getting well-researched answers to complex questions.',
  inputSchema: IAskToolSchema,
  annotations: {
    readOnlyHint: true,
    openWorldHint: false
  }
};

/**
 * IAsk AI search tool handler
 * @param {z.infer<typeof IAskToolSchema>} params - The tool parameters
 */
export async function iaskToolHandler(params: z.infer<typeof IAskToolSchema>): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  const {
    query,
    mode = 'thinking',
    detailLevel = 'concise'
  } = params;

  console.log(`Searching IAsk AI for: "${query}" (mode: ${mode}, detailLevel: ${detailLevel || 'default'})`);

  try {
    const response: string = await searchIAsk(query, mode, detailLevel || undefined);

    return {
      content: [
        {
          type: 'text' as const,
          text: response || 'No results found.'
        }
      ]
    };
  } catch (error: any) {
    console.error(`Error in IAsk search: ${error.message}`);
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error searching IAsk: ${error.message}`
        }
      ]
    };
  }
}
