import { searchMonica } from  '@/app/api/test-mcp/utils/search_monica';
import { z } from "zod";

// InputSchema - Parámetros que recibe
export const MonicaToolSchema = z.object({
  query: z.string()
    .describe('The search query or question.'),
});

/**
 * Monica AI search tool definition
 */
export const monicaToolDefinition = {
  title: 'Monica AI Search',
  description: 'AI-powered search using Monica AI. Returns AI-generated responses based on web content.',
  inputSchema: MonicaToolSchema,
  annotations: {
    readOnlyHint: true,
    openWorldHint: false
  }
};

/**
 * Monica AI search tool handler
 * @param {any} params - The tool parameters
 * @returns {Promise<any>} - The tool result
 */
export async function monicaToolHandler(params: any) {
  const { query } = params;

  console.log(`Searching Monica AI for: "${query}"`);

  try {
    const result = await searchMonica(query);
    return {
      content: [
        {
          type: 'text',
          text: result || 'No results found.'
        }
      ]
    };
  } catch (error: any) {
    console.error(`Error in Monica search: ${error.message}`);
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error searching Monica: ${error.message}`
        }
      ]
    };
  }
}
