import { tavily } from "@tavily/core";
import { redisCache } from '@/app/api/web-search/utils/redis';
import { checkRateLimit } from '@/app/api/web-search/utils/ratelimit';

// Initialize the client (Make sure you have the environment variable in Vercel)
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

export const tavilySearchHandler = async ({ query, searchDepth = "basic" }: { query: string, searchDepth?: "basic" | "advanced" }) => {
    try {
        // 1. Check Rate Limit (10 requests per minute as safe default)
        const rateLimitKey = 'rl:tavily';
        const isAllowed = await checkRateLimit(rateLimitKey, 10, 60);
        if (!isAllowed) {
            return {
                content: [{
                    type: "text" as const,
                    text: "⚠️ Se ha excedido el límite de peticiones de búsqueda. Por favor, inténtalo de nuevo en un minuto."
                }],
            };
        }

        // 2. Check Redis Cache
        const cacheKey = `cache:tavily:${searchDepth}:${query.trim().toLowerCase()}`;
        const cachedResults = await redisCache.get<any>(cacheKey);

        if (cachedResults) {
            console.log(`[CACHE] Hit for query: "${query}"`);
            return cachedResults;
        }

        // 3. Execute the search if not in cache
        const response = await tvly.search(query, {
            searchDepth: searchDepth,
            maxResults: 5,
        });

        if (!response.results || response.results.length === 0) {
            const noResults = {
                content: [{ type: "text" as const, text: "No se encontraron resultados relevantes." }],
            };
            // Cache "no results" for a shorter time (5 mins)
            await redisCache.set(cacheKey, noResults, 300);
            return noResults;
        }

        // Format the results for the LLM
        const formattedResults = response.results
            .map((r: any) => `Título: ${r.title}\nURL: ${r.url}\nContenido: ${r.content}\n---`)
            .join("\n");

        const result = {
            content: [{ type: "text" as const, text: formattedResults }],
        };

        // 4. Save results to Redis Cache (TTL: 5 minutes)
        await redisCache.set(cacheKey, result, 300);
        console.log(`[CACHE] Stored results for query: "${query}"`);

        return result;
    } catch (error) {
        console.error("Tavily Error:", error);
        return {
            content: [{ type: "text" as const, text: `Error al consultar Tavily: ${error instanceof Error ? error.message : String(error)}` }],
        };
    }
};