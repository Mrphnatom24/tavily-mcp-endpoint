import { tavily } from "@tavily/core";

// Inicializar el cliente (Asegúrate de tener la variable de entorno en Vercel)
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

export const tavilySearchHandler = async ({ query, searchDepth = "basic" }: { query: string, searchDepth?: "basic" | "advanced" }) => {
    try {
        // Ejecutar la búsqueda
        const response = await tvly.search(query, {
            searchDepth: searchDepth,
            maxResults: 5,
        });

        if (!response.results || response.results.length === 0) {
            return {
                content: [{ type: "text" as const, text: "No se encontraron resultados relevantes." }],
            };
        }

        // Formatear los resultados para el LLM
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