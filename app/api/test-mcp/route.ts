// app/api/[transport]/route.ts
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

// Import tool definitions and handlers
import { searchToolDefinition, searchToolHandler } from '@/app/api/test-mcp/tools/searchTool';
import { iaskToolDefinition, iaskToolHandler } from '@/app/api/test-mcp/tools/iaskTool';
import { monicaToolDefinition, monicaToolHandler } from '@/app/api/test-mcp/tools/monicaTool';

const handler = createMcpHandler(
  (server: any) => {
    server.registerTool(
      "roll_dice",
      {
        title: "Roll Dice",
        description: "Roll a dice with a specified number of sides.",
        inputSchema: {
          sides: z.number().int().min(2),
        },
      },//////
      async ({ sides }: { sides: number }) => {
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
  {},
  {
    basePath: "/api/test-mcp", // must match where [transport] is located
    maxDuration: 30,
    verboseLogs: true,
  }
);

export { handler as GET, handler as POST };