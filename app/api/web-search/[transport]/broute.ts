// app/api/web-search/[transport]/route.ts
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

// Obligatorio para evitar problemas de streaming en Next.js
export const dynamic = 'force-dynamic';

// Import tool definitions and handlers
import { searchToolDefinition, searchToolHandler } from '@/app/api/web-search/tools/searchTool';
import { iaskToolDefinition, iaskToolHandler } from '@/app/api/web-search/tools/iaskTool';
import { monicaToolDefinition, monicaToolHandler } from '@/app/api/web-search/tools/monicaTool';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const handler = createMcpHandler(
  (server: McpServer) => {
    // Register tools
    server.registerTool(
      "roll_dice",
      {
        title: "Roll Dice",
        description: "Roll a dice with a specified number of sides.",
        inputSchema: {
          sides: z.number().int().min(2),
        },
      },
      async ({ sides }: {sides: number}) => {
        const value = 1 + Math.floor(Math.random() * sides);
        return {
          content: [{ type: "text", text: `🎲 You rolled a ${value}!` }],
        };
      }
    );

    server.registerTool("web-search", searchToolDefinition, searchToolHandler);
    server.registerTool("iask-search", iaskToolDefinition, iaskToolHandler);
    server.registerTool("monica-search", monicaToolDefinition, monicaToolHandler);
  },
  // Server info
  {
    serverInfo: {
      name: "Web Search Server",
      version: "1.0.0",
    },
  },
  {
    // Server options
    basePath: "/api/web-search", // must match where [transport] is located
    maxDuration: 60,
    verboseLogs: true,
  }
);


export { handler as GET, handler as POST };