import { tavily } from "@tavily/core";
import { redisCache } from '@/app/api/web-search/utils/redis';
import { checkRateLimit } from '@/app/api/web-search/utils/ratelimit';

// Initialize the client (Make sure you have the environment variable in Vercel)
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

export const tavilySearchHandler = async ({ query, searchDepth = "basic" }: { query: string, searchDepth?: "basic" | "advanced" }) => {
    try {
        // Execute the search
        const response = await tvly.search(query, {
            searchDepth: searchDepth,
            maxResults: 5,
        });

        if (!response.results || response.results.length === 0) {
            return {
                content: [{ type: "text" as const, text: "No se encontraron resultados relevantes." }],
            };
        }

        // Format the results for the LLM
        const formattedResults = response.results
            .map((r: any) => `Título: ${r.title}\nURL: ${r.url}\nContenido: ${r.content}\n---`)
            .join("\n");

        return {
            content: [{ type: "text" as const, text: formattedResults }],
        };
    } catch (error) {
        console.error("Tavily Error:", error);
        return {
            content: [{ type: "text" as const, text: `Error al consultar Tavily: ${error instanceof Error ? error.message : String(error)}` }],
        };
    }
};