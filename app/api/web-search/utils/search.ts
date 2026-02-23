import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { getRandomUserAgent } from '@/app/api/web-search/utils/user_agents';
import { redisCache } from '@/app/api/web-search/utils/redis';
import { checkRateLimit } from '@/app/api/web-search/utils/ratelimit';

// Constants
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const EMPTY_CACHE_DURATION = 30 * 1000; // 30 seconds for empty results
const REQUEST_TIMEOUT = 10000; // 15 seconds
const JINA_DELAY_MS = 0; //800; // Delay between Jina AI requests
const JINA_TIMEOUT_PER_RESULT = 8000; // Extra timeout per result requested
const MAX_SEARCH_RETRIES = 1; // Number of retries for DuckDuckGo
const MAX_DESCRIPTION_LENGTH = 4000; // Maximum length of description
const MAXIMUM_ENRICHMENT_TIMEOUT = 15000; // Maximum enrichment timeout
const MAX_RESULTS = 7; // Maximum number of results


// HTTPS agent configuration to handle certificate chain issues
const httpsAgent = new https.Agent({
  rejectUnauthorized: true,
  keepAlive: false, // Deshabilitado para evitar sockets zombies en App Router
  timeout: REQUEST_TIMEOUT,
  // Provide fallback for certificate issues while maintaining security
  secureProtocol: 'TLSv1_2_method'
});

/**
 * Generate a cache key for a search query
 * @param {string} query - The search query
 * @param {string} mode - The search mode
 * @param {number} numResults - Number of results
 * @returns {string} The cache key
 */
function getCacheKey(query: string, mode: string, numResults: number) {
  return `${query}:${mode}:${numResults}`;
}

/**
 * Extract the direct URL from a DuckDuckGo redirect URL
 * @param {string} duckduckgoUrl - The DuckDuckGo URL to extract from
 * @returns {string} The direct URL
 */
function extractDirectUrl(duckduckgoUrl: string) {
  try {
    // Handle relative URLs from DuckDuckGo
    if (duckduckgoUrl.startsWith('//')) {
      duckduckgoUrl = 'https:' + duckduckgoUrl;
    } else if (duckduckgoUrl.startsWith('/')) {
      duckduckgoUrl = 'https://duckduckgo.com' + duckduckgoUrl;
    }

    const url = new URL(duckduckgoUrl);

    // Extract direct URL from DuckDuckGo redirect
    if (url.hostname === 'duckduckgo.com' && url.pathname === '/l/') {
      const uddg = url.searchParams.get('uddg');
      if (uddg) {
        return decodeURIComponent(uddg);
      }
    }

    // Handle ad redirects
    if (url.hostname === 'duckduckgo.com' && url.pathname === '/y.js') {
      const u3 = url.searchParams.get('u3');
      if (u3) {
        try {
          const decodedU3 = decodeURIComponent(u3);
          const u3Url = new URL(decodedU3);
          const clickUrl = u3Url.searchParams.get('ld');
          if (clickUrl) {
            return decodeURIComponent(clickUrl);
          }
          return decodedU3;
        } catch {
          return duckduckgoUrl;
        }
      }
    }

    return duckduckgoUrl;
  } catch {
    // If URL parsing fails, try to extract URL from a basic string match
    const urlMatch = duckduckgoUrl.match(/https?:\/\/[^\s<>"]+/);
    if (urlMatch) {
      return urlMatch[0];
    }
    return duckduckgoUrl;
  }
}

/**
 * Get a favicon URL for a given website URL
 * @param {string} url - The website URL
 * @returns {string} The favicon URL
 */
function getFaviconUrl(url: string) {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
  } catch {
    return ''; // Return empty string if URL is invalid
  }
}

/**
 * Generate a Jina AI URL for a given website URL
 * @param {string} url - The website URL
 * @returns {string} The Jina AI URL
 */
function getJinaAiUrl(url: string) {
  try {
    const urlObj = new URL(url);
    return `https://r.jina.ai/${urlObj.href}`;
  } catch {
    return '';
  }
}

/**
 * Scrapes search results from DuckDuckGo HTML
 * @param {string} query - The search query
 * @param {number} numResults - Number of results to return (default: 10)
 * @param {string} mode - 'short' or 'detailed' mode (default: 'short')
 * @returns {Promise<Array>} - Array of search results
 */
async function searchDuckDuckGo(query: string, numResults: number = 3, mode: string = 'short') {
  try {
    // Input validation
    if (!query || typeof query !== 'string') {
      throw new Error('Invalid query: query must be a non-empty string');
    }

    if (!Number.isInteger(numResults) || numResults < 1 || numResults > MAX_RESULTS) {
      throw new Error(`Invalid numResults: must be an integer between 1 and ${MAX_RESULTS}`);
    }

    if (!['short', 'detailed'].includes(mode)) {
      throw new Error('Invalid mode: must be "short" or "detailed"');
    }

    const startTime = Date.now();
    console.log(`[SCRAPER_LOG][START] Query: "${query}" | Mode: ${mode} | Results: ${numResults}`);

    // Rate Limiting (Prevent IP bans)
    const isAllowed = await checkRateLimit('rl:duckduckgo', 20, 60); // 20 requests per minute
    if (!isAllowed) {
      console.warn(`[SCRAPER_LOG][RATELIMIT] Rate limit exceeded for DuckDuckGo. Query: "${query}"`);
      throw new Error('Rate limit exceeded for web search. Please wait a moment.');
    }

    // Check Redis cache first
    const cacheKey = getCacheKey(query, mode, numResults);
    const cachedResults = await redisCache.get<any[]>(cacheKey);

    if (cachedResults) {
      console.log(`[SCRAPER_LOG][CACHE_HIT] Query: "${query}" | Mode: ${mode}`);
      return cachedResults;
    }

    let searchItems: any[] = [];
    let retryCount = 0;
    let html = '';

    while (retryCount <= MAX_SEARCH_RETRIES && searchItems.length === 0) {
      if (retryCount > 0) {
        console.log(`Retry ${retryCount}/${MAX_SEARCH_RETRIES} for query: "${query}"`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }

      const userAgent = getRandomUserAgent();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        const response = await axios.get(
          `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
          {
            signal: controller.signal,
            headers: {
              'User-Agent': userAgent,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
              'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
              'Referer': 'https://duckduckgo.com/',
              'DNT': '1',
              'Upgrade-Insecure-Requests': '1',
              'Cache-Control': 'max-age=0',
            },
            httpsAgent: httpsAgent,
            timeout: REQUEST_TIMEOUT
          }
        );

        clearTimeout(timeoutId);

        if (response.status === 202) {
          console.log('DuckDuckGo returned 202 (Accepted). Search might be delayed or partial.');
        }

        html = response.data;
        const $ = cheerio.load(html);

        // Try multiple selectors
        const resultSelectors = ['.result', '.results_links', '.web-result'];

        for (const selector of resultSelectors) {
          $(selector).each((i, result) => {
            const $result = $(result);
            const titleEl = $result.find('.result__title a, .rt-title a');
            const linkEl = $result.find('.result__url, .rt-url');
            const snippetEl = $result.find('.result__snippet, .rt-snippet');

            const title = titleEl.text()?.trim();
            const rawLink = titleEl.attr('href');
            const description = snippetEl.text()?.trim();
            const displayUrl = linkEl.text()?.trim();

            const directLink = extractDirectUrl(rawLink || '');
            const favicon = getFaviconUrl(directLink);
            const jinaUrl = getJinaAiUrl(directLink);

            if (title && directLink) {
              searchItems.push({
                title,
                directLink,
                description,
                favicon,
                displayUrl,
                jinaUrl
              });
            }
          });
          if (searchItems.length > 0) break;
        }

        if (searchItems.length === 0) {
          const pageTitle = $('title').text() || 'No title';
          console.warn(`Attempt ${retryCount + 1} found 0 results. Title: "${pageTitle}". HTML length: ${html.length}`);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        console.error(`Fetch attempt ${retryCount + 1} failed: ${fetchError.message}`);
      }
      retryCount++;
    }

    if (searchItems.length === 0) {
      console.warn(`Final: No results found on DuckDuckGo for: "${query}" after ${retryCount} attempts.`);
      await redisCache.set(cacheKey, [], EMPTY_CACHE_DURATION / 1000);
      return [];
    }

    const results = searchItems.map(item => ({
      title: item.title,
      url: item.directLink,
      snippet: item.description || '',
      favicon: item.favicon,
      displayUrl: item.displayUrl || '',
      description: ''
    }));

    if (mode === 'short') {
      const limitedResults = results.slice(0, numResults);
      await redisCache.set(cacheKey, limitedResults, CACHE_DURATION / 1000);
      console.log(`[SCRAPER_LOG][SUCCESS] Query: "${query}" | Found ${limitedResults.length} results | Time: ${Date.now() - startTime}ms`);
      return limitedResults;
    }

    console.log(`[SCRAPER_LOG][ENRICH] Enriching ${results.length} results with Jina AI...`);
    const enrichmentPromises = searchItems.map(async (item, index) => {
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, index * JINA_DELAY_MS));
      }
      try {
        const jinaRes = await axios.get(item.jinaUrl, {
          headers: { 'User-Agent': getRandomUserAgent() },
          httpsAgent: httpsAgent,
          timeout: JINA_TIMEOUT_PER_RESULT
        });
        if (jinaRes.status === 200 && typeof jinaRes.data === 'string') {
          //const $jina = cheerio.load(jinaRes.data);
          results[index].description = jinaRes.data.slice(0, MAX_DESCRIPTION_LENGTH);
        }
      } catch (error: any) {
        console.warn(`Jina enrichment failed for ${item.directLink}: ${error.message}`);
      }
    });

    const enrichmentTimeoutMs = Math.min(MAXIMUM_ENRICHMENT_TIMEOUT, results.length * JINA_TIMEOUT_PER_RESULT);
    await Promise.race([
      Promise.all(enrichmentPromises),
      new Promise(resolve => setTimeout(() => {
        console.warn(`Enrichment global timeout reached (${enrichmentTimeoutMs}ms). Returning partial results.`);
        resolve(null);
      }, enrichmentTimeoutMs))
    ]);

    const limitedResults = results.slice(0, numResults);
    await redisCache.set(cacheKey, limitedResults, CACHE_DURATION / 1000);

    console.log(`[SCRAPER_LOG][SUCCESS] Query: "${query}" | Found ${limitedResults.length} enriched results | Time: ${Date.now() - startTime}ms`);
    return limitedResults;
  } catch (error: any) {
    console.error(`[SCRAPER_LOG][ERROR] Query: "${query}" | Error: ${error.message}`);
    throw new Error(`Search failed for "${query}": ${error.message}`);
  }
}

export {
  searchDuckDuckGo,
  extractDirectUrl,
  getFaviconUrl,
  getJinaAiUrl
};