# MCP Web Search Server (Next.js)

Este proyecto es una implementación de un servidor **Model Context Protocol (MCP)** desarrollado con **Next.js**. Permite que modelos de Inteligencia Artificial (LLM) se comuniquen con herramientas externas, específicamente proporcionando capacidades de búsqueda web avanzada a través de Tavily AI.

## 🚀 Características Principales

- **Protocolo MCP Completo**: Implementación del estándar Model Context Protocol para una integración perfecta con clientes compatibles (como Claude Desktop, IDEs con soporte MCP, etc.).
- **Búsqueda Web con IA**: Integración con **Tavily AI** para obtener resultados de búsqueda optimizados para LLMs.
- **Arquitectura Serverless**: Diseñado para funcionar en entornos como Vercel utilizando Next.js App Router.
- **Gestión de Sesiones**: Soporta múltiples transportes y gestión de estado mediante `mcp-handler`.
- **Rendimiento y Seguridad**: 
  - **Rate Limiting**: Limitación de peticiones mediante Redis para evitar abusos.
  - **Caching**: Almacenamiento en caché de resultados para respuestas más rápidas y ahorro de cuotas de API.

## 🛠️ Tecnologías Utilizadas

- **Soporte Core**: [Next.js 15+](https://nextjs.org), [TypeScript](https://www.typescriptlang.org/).
- **MCP SDK**: [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk).
- **Manejador MCP**: `mcp-handler` para simplificar la creación de endpoints SSE/HTTP.
- **Búsqueda**: [Tavily AI SDK](https://tavily.com/).
- **Base de Datos/Caché**: [Redis](https://redis.io/) (vía `ioredis`).
- **Validación**: [Zod](https://zod.dev/) para esquemas de entrada de herramientas.

## ⚙️ Configuración del Entorno

Para ejecutar este proyecto, necesitas configurar las siguientes variables de entorno en un archivo `.env.local`:

```env
# Tavily AI Search API Key
TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxxxxxxxxx

# Redis Connection (Opcional, pero recomendado para Rate Limiting)
REDIS_URL=rediss://default:xxxxxx@xxxxxx.upstash.io:6379
```

## 📦 Instalación y Ejecución

1. Clona el repositorio.
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
4. El servidor MCP estará disponible en: `http://localhost:3000/api/web-search/sse`

## 🛠️ Herramientas Disponibles (Tools)

El servidor expone las siguientes herramientas que los modelos de IA pueden utilizar:

1. **`saludar`**: Una herramienta sencilla para pruebas de conectividad que devuelve un saludo personalizado.
2. **`tavily-search`**: Ejecuta búsquedas web avanzadas.
   - **Parámetros**:
     - `query` (string): La consulta de búsqueda.
     - `search_depth` (enum: 'basic' | 'advanced'): Profundidad de la búsqueda.

## Como indicar el servidor al cliente IA
```json
"mcpServers": {
    "mi-servidor-nextjs": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://localhost:3000/api/web-search/sse"
      ]
    }
}
```


## 📂 Estructura del Proyecto

- `/app/api/web-search/`: Carpeta principal del servidor MCP.
  - `/[transport]/route.ts`: Endpoint dinámico para manejar transportes (SSE).
  - `/tools/`: Definiciones y lógica de las herramientas MCP.
  - `/utils/`: Utilidades para búsqueda, Redis y control de tasa.

## 📘 Documentación Adicional

Para más detalles técnicos sobre la implementación y cómo conectar clientes externos, consulta la [Guía Técnica](./GUIA_TECNICA.md).
