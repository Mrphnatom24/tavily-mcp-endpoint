import axios from 'axios';
import WebSocket from 'ws';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import * as tough from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import { getRandomUserAgent } from '@/app/api/web-search/utils/user_agents';
import { redisCache } from '@/app/api/web-search/utils/redis';

const { CookieJar } = tough;

// Valid modes and detail levels
const VALID_MODES = ['question', 'academic', 'forums', 'wiki', 'thinking'] as const;
const VALID_DETAIL_LEVELS = ['concise', 'detailed', 'comprehensive'] as const;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const DEFAULT_RESPONSE_TIMEOUT = 20000;
const DEFAULT_CONNECTION_TIMEOUT = 6000;
const API_ENDPOINT = 'https://iask.ai/';

/**
 * Generate a cache key for a search query
 * @param {string} query - The search query
 * @param {string} mode - The search mode
 * @param {string|null} detailLevel - The detail level
 * @returns {string} The cache key
 */
function getCacheKey(query: string, mode: string, detailLevel: string | null) {
  return `iask-${mode}-${detailLevel || 'default'}-${query}`;
}

/**
 * Recursively search for cached HTML content in diff object
 * @param {any} diff - The diff object to search
 * @returns {string|null} The found content or null
 */
function cacheFind(diff: any): string | null {
  const values = Array.isArray(diff) ? diff : Object.values(diff);

  for (const value of values) {
    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
      const cache: string | null = cacheFind(value);
      if (cache) return cache;
    }

    if (typeof value === 'string' && /<p>.+?<\/p>/.test(value)) {
      const turndownService = new TurndownService();
      return turndownService.turndown(value).trim();
    }
  }

  return null;
}

/**
 * Format HTML content into readable markdown text
 * @param {string} htmlContent - The HTML content to format
 * @returns {string} Formatted text
 */
function formatHtml(htmlContent: string) {
  if (!htmlContent) return '';

  const $ = cheerio.load(htmlContent);
  const outputLines: string[] = [];

  $('h1, h2, h3, p, ol, ul, div').each((_, element) => {
    const $el = $(element);
    const tagName = ($el.prop('tagName') || '').toLowerCase();

    if (['h1', 'h2', 'h3'].includes(tagName)) {
      outputLines.push(`\n**${$el.text().trim()}**\n`);
    } else if (tagName === 'p') {
      let text = $el.text().trim();
      // Remove IAsk attribution
      text = text.replace(/^According to Ask AI & Question AI www\.iAsk\.ai:\s*/i, '').trim();
      // Remove footnote markers
      text = text.replace(/\[\d+\]\(#fn:\d+ 'see footnote'\)/g, '');
      if (text) outputLines.push(text + '\n');
    } else if (['ol', 'ul'].includes(tagName)) {
      $el.find('li').each((_, li) => {
        outputLines.push('- ' + $(li).text().trim() + '\n');
      });
    } else if (tagName === 'div' && $el.hasClass('footnotes')) {
      outputLines.push('\n**Authoritative Sources**\n');
      $el.find('li').each((_, li) => {
        const link = $(li).find('a');
        if (link.length) {
          outputLines.push(`- ${link.text().trim()} (${link.attr('href')})\n`);
        }
      });
    }
  });

  return outputLines.join('');
}

/**
 * Search using IAsk AI via WebSocket (Phoenix LiveView)
 * @param {string} prompt - The search query or prompt
 * @param {string} mode - Search mode: 'question', 'academic', 'forums', 'wiki', 'thinking'
 * @param {string|null} detailLevel - Detail level: 'concise', 'detailed', 'comprehensive'
 * @returns {Promise<string>} The search results
 */
async function searchIAsk(prompt: string, mode: string = 'thinking', detailLevel: string | null = null): Promise<string> {
  // Input validation
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Invalid prompt: prompt must be a non-empty string');
  }

  // Validate mode
  if (!(VALID_MODES as readonly string[]).includes(mode)) {
    throw new Error(`Invalid mode: ${mode}. Valid modes are: ${VALID_MODES.join(', ')}`);
  }

  // Validate detail level
  if (detailLevel && !(VALID_DETAIL_LEVELS as readonly string[]).includes(detailLevel)) {
    throw new Error(`Invalid detail level: ${detailLevel}. Valid levels are: ${VALID_DETAIL_LEVELS.join(', ')}`);
  }

  const startTime = Date.now();
  console.log(`[IASK_LOG][START] Prompt: "${prompt.substring(0, 50)}..." | Mode: ${mode} | Detail: ${detailLevel || 'default'}`);

  const cacheKey = getCacheKey(prompt, mode, detailLevel);
  const cachedResults = await redisCache.get<string>(cacheKey);

  if (cachedResults) {
    console.log(`[IASK_LOG][CACHE_HIT] Prompt: "${prompt.substring(0, 50)}..."`);
    return cachedResults;
  }

  // Build URL parameters
  const params = new URLSearchParams({ mode, q: prompt });
  if (detailLevel) {
    params.append('options[detail_level]', detailLevel);
  }

  // Create a cookie jar for session management
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar }));

  try {
    // Get initial page and extract tokens
    console.log('Fetching IAsk AI initial page...');
    const response = await client.get(API_ENDPOINT, {
      params: Object.fromEntries(params),
      timeout: DEFAULT_RESPONSE_TIMEOUT,
      headers: {
        'User-Agent': getRandomUserAgent()
      }
    });

    const $ = cheerio.load(response.data);

    const phxNode = $('[id^="phx-"]').first();
    const csrfToken = $('[name="csrf-token"]').attr('content');
    const phxId = phxNode.attr('id');
    const phxSession = phxNode.attr('data-phx-session');

    if (!phxId || !csrfToken) {
      throw new Error('Failed to extract required tokens from IAsk AI page');
    }

    // Get the actual response URL (after any redirects)
    const responseUrl = response.request.res?.responseUrl || response.config.url;

    // Get cookies from the jar for WebSocket connection
    const cookies = await jar.getCookies(API_ENDPOINT);
    const cookieString = cookies.map(c => `${c.key}=${c.value}`).join('; ');

    // Build WebSocket URL
    const wsParams = new URLSearchParams({
      '_csrf_token': csrfToken,
      'vsn': '2.0.0'
    });
    const wsUrl = `wss://iask.ai/live/websocket?${wsParams.toString()}`;

    return new Promise<string>((resolve, reject) => {
      const ws = new WebSocket(wsUrl, {
        headers: {
          'Cookie': cookieString,
          'User-Agent': getRandomUserAgent(),
          'Origin': 'https://iask.ai'
        }
      });

      let buffer = '';
      let timeoutId: any;
      let connectionTimeoutId: any;

      // Set connection timeout
      connectionTimeoutId = setTimeout(() => {
        ws.close();
        reject(new Error('IAsk connection timeout: unable to establish WebSocket connection'));
      }, DEFAULT_CONNECTION_TIMEOUT);

      ws.on('open', () => {
        clearTimeout(connectionTimeoutId);
        console.log('IAsk WebSocket connection established');

        // Send phx_join message
        ws.send(JSON.stringify([
          null,
          null,
          `lv:${phxId}`,
          'phx_join',
          {
            params: { _csrf_token: csrfToken },
            url: responseUrl,
            session: phxSession
          }
        ]));

        // Set message timeout
        timeoutId = setTimeout(() => {
          ws.close();
          if (buffer) {
            resolve(buffer || 'No results found.');
          } else {
            reject(new Error('IAsk response timeout: no response received'));
          }
        }, DEFAULT_RESPONSE_TIMEOUT);
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (!msg) return;

          const diff = msg[4];
          if (!diff) return;

          let chunk = null;

          try {
            // Try to get chunk from diff.e[0][1].data
            if (diff.e) {
              chunk = diff.e[0][1].data;

              if (chunk) {
                let formatted;
                if (/<[^>]+>/.test(chunk)) {
                  formatted = formatHtml(chunk);
                } else {
                  formatted = chunk.replace(/<br\/>/g, '\n');
                }

                buffer += formatted;
              }
            } else {
              throw new Error('No diff.e');
            }
          } catch {
            // Fallback to cacheFind
            const cache = cacheFind(diff);
            if (cache) {
              let formatted;
              if (/<[^>]+>/.test(cache)) {
                formatted = formatHtml(cache);
              } else {
                formatted = cache;
              }
              buffer += formatted;
              // Close after cache find
              ws.close();
              return;
            }
          }
        } catch (err: any) {
          console.error('Error parsing IAsk message:', err.message);
        }
      });

      ws.on('close', async () => {
        clearTimeout(timeoutId);
        clearTimeout(connectionTimeoutId);

        console.log(`[IASK_LOG][SUCCESS] Search completed: ${buffer.length} characters in ${Date.now() - startTime}ms`);

        // Cache the result
        if (buffer) {
          await redisCache.set(cacheKey, buffer, CACHE_DURATION / 1000);
        }

        resolve(buffer || 'No results found.');
      });

      ws.on('error', (err) => {
        clearTimeout(timeoutId);
        clearTimeout(connectionTimeoutId);
        console.error('IAsk WebSocket error:', err.message);

        if (err.message.includes('timeout')) {
          reject(new Error('IAsk WebSocket timeout: connection took too long'));
        } else if (err.message.includes('connection refused')) {
          reject(new Error('IAsk connection refused: service may be unavailable'));
        } else {
          reject(new Error(`IAsk WebSocket error: ${err.message}`));
        }
      });
    });
  } catch (error: any) {
    console.error('Error in IAsk search:', error.message);

    // Enhanced error handling
    if (error.code === 'ENOTFOUND') {
      throw new Error('IAsk network error: unable to resolve host');
    }

    if (error.code === 'ECONNREFUSED') {
      throw new Error('IAsk network error: connection refused');
    }

    if (error.message.includes('timeout')) {
      throw new Error(`IAsk timeout: ${error.message}`);
    }

    throw new Error(`IAsk search failed for "${prompt}": ${error.message}`);
  }
}

export { searchIAsk, VALID_MODES, VALID_DETAIL_LEVELS };
