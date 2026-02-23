// app/api/web-search/[transport]/route.ts
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";


export const maxDuration = 30; // Incrementa a 60 si es necesario y tienes plan Pro
export const dynamic = 'force-dynamic'; // Obligatorio para evitar que Next.js cachee el stream de SSE
export const runtime = 'nodejs'; // Recomendado para mayor compatibilidad con SDKs

// Import tool definitions and handlers
import { searchToolDefinition, searchToolHandler } from '@/app/api/web-search/tools/searchTool';
import { iaskToolDefinition, iaskToolHandler } from '@/app/api/web-search/tools/iaskTool';
import { monicaToolDefinition, monicaToolHandler } from '@/app/api/web-search/tools/monicaTool';
import { tavilyToolDefinition, tavilyToolHandler } from '@/app/api/web-search/tools/tavilyTool';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const handler = createMcpHandler(
  (server: McpServer) => {
    server.registerTool(
      "saludar",
      {
        title: "Saludar",
        description: "Saluda a la persona que te habla.",
        inputSchema: {
          nombre: z.string(),
        },
      },
      async ({ nombre }) => {
        return {
          content: [{ type: "text", text: `Hola ${nombre}!` }],
        };
      }
    );

    server.registerTool("web-search", searchToolDefinition, searchToolHandler);
    server.registerTool("iask-search", iaskToolDefinition, iaskToolHandler);
    server.registerTool("monica-search", monicaToolDefinition, monicaToolHandler);
    server.registerTool("tavily-search", tavilyToolDefinition, tavilyToolHandler);
  },
  // 2. Proporcionar información del servidor (requerido por algunos clientes)
  {
    serverInfo: {
      name: "Web Search Server",
      version: "1.0.0",
    },
  },
  {
    basePath: "/api/web-search",
    maxDuration: 30,  // Worst-case scenario
    verboseLogs: true,
    redisUrl: process.env.REDIS_URL,
  }
);

// 3. Exportar métodos y manejar CORS manualmente si es necesario
export { handler as GET, handler as POST };

// 4. Añadir manejador OPTIONS para CORS (Preflight)
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-mcp-protocol-version',
    },
  });
}