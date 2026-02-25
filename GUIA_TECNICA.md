# Guía Técnica: Servidor MCP con Next.js

Este documento proporciona una visión profunda de la arquitectura y el funcionamiento interno del servidor MCP (Model Context Protocol).

## 🏗️ Arquitectura del Sistema

El servidor está construido sobre la infraestructura de Next.js, aprovechando los **Route Handlers** para exponer un endpoint MCP.

### Flujo de Comunicación

1. **Cliente MCP**: (p. ej. Claude Desktop) inicia una conexión SSE (Server-Sent Events) hacia `/api/web-search/sse`.
2. **McpHandler**: Gestiona la sesión, el protocolo de mensajes JSON-RPC y el mantenimiento de la conexión.
3. **Registro de Herramientas**: Las herramientas se definen en `/app/api/web-search/tools/` y se registran dinámicamente en el servidor en el momento de la instanciación.
4. **Validación**: Se utiliza **Zod** para asegurar que los argumentos enviados por el LLM cumplen con el esquema requerido.

## 🛠️ Implementación de Herramientas

Las herramientas se dividen en dos partes:
- **Definición**: El esquema que se envía al LLM para que sepa cómo llamar a la herramienta.
- **Handler**: La función asíncrona que ejecuta la lógica real.

### Ejemplo: Herramienta de Búsqueda (Tavily)

La herramienta utiliza el SDK de Tavily para obtener resultados. La lógica de búsqueda incluye:
- Formateo de resultados para que sean fácilmente legibles por un LLM.
- Manejo de errores para evitar que el servidor falle si la API externa falla.

## 🗄️ Infraestructura y Utilidades

### Redis (Caché y Rate Limit)
Se utiliza Redis para dos propósitos críticos:
1. **Rate Limiting**: El archivo `utils/ratelimit.ts` implementa un algoritmo de contador simple para limitar el número de llamadas por ventana de tiempo, protegiendo las cuotas de las APIs externas.
2. **Resiliencia**: El cliente de Redis está diseñado para fallar de forma silenciosa (fail-open), permitiendo que el servidor siga funcionando incluso si Redis no está disponible.

## 🔌 Cómo Conectar un Cliente (Claude Desktop)

Para probar este servidor localmente con el cliente de Claude Desktop, añade lo siguiente a tu archivo de configuración de Claude (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "nextjs-search": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-proxy",
        "http://localhost:3000/api/web-search/sse"
      ]
    }
  }
}
```

*Nota: Asegúrate de que el servidor de Next.js esté corriendo (`npm run dev`) antes de iniciar Claude.*

## 🚀 Despliegue

Este proyecto está listo para ser desplegado en **Vercel**. Al desplegar:
- Configura las variables de entorno `TAVILY_API_KEY` y `REDIS_URL`.
- La ruta `/api/web-search/[transport]` manejará automáticamente las peticiones POST y GET (SSE).
- Asegúrate de que el tiempo de ejecución esté configurado como `nodejs` (especificado en `route.ts`).

## ⚠️ Consideraciones de Seguridad

- El servidor implementa un manejador de `OPTIONS` para permitir CORS en entornos de desarrollo.
- En producción, es recomendable restringir los orígenes permitidos en las cabeceras de `Access-Control-Allow-Origin`.
