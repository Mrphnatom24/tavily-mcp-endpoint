// app/api/web-search/[transport]/route.ts

// Import tool definitions and handlers
import { createMcpHandler } from "mcp-handler";
import { tavilyToolDefinition, tavilyToolHandler } from '@/app/api/web-search/tools/tavilyTool';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export const maxDuration = 30; // Incrementa a 60 si es necesario y tienes plan Pro
export const dynamic = 'force-dynamic'; // Obligatorio para evitar que Next.js cachee el stream de SSE
export const runtime = 'nodejs'; // Recomendado para mayor compatibilidad con SDKs

const handler = createMcpHandler(
  (server: McpServer) => {
    // Register tools
    server.registerTool(
      "saludar",
      {
        title: "Saludar",
        description: "Saluda a la persona que te habla.",
        inputSchema: {
          nombre: z.string(),
        },
      },
      async ({ nombre }: { nombre: string }) => {
        return {
          content: [{ type: "text", text: `Hola ${nombre}!` }],
        };
      }
    );


    server.registerTool("tavily-search", tavilyToolDefinition, tavilyToolHandler);
  },
  // Provide server information (required by some clients)
  {
    serverInfo: {
      name: "Web Search Server",
      version: "1.0.0",
    },
  },
  {
    basePath: "/api/web-search", // Base path for the API -> must match where [transport] is located
    maxDuration: 30,  // Worst-case scenario
    verboseLogs: true,
    redisUrl: process.env.REDIS_URL,
  }
);

// Export methods and handle CORS manually if needed
export { handler as GET, handler as POST };

// Add OPTIONS handler for CORS (Preflight)
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-mcp-protocol-version, x-mcp-session-id',
      'X-Accel-Buffering': 'no',
    },
  });
}