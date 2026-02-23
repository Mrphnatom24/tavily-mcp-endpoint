import { searchIAsk } from './app/api/web-search/utils/search_iask';

async function testPerformance() {
    const queries = [
        "Who is the current president of the USA?",
        "What is the weather in Madrid?",
        "Summarize the plot of Inception"
    ];

    console.log('Starting IAsk AI performance evaluation...');

    for (const query of queries) {
        const start = Date.now();
        try {
            console.log(`\n[TEST] Query: "${query}"`);
            const result = await searchIAsk(query, 'thinking', 'comprehensive');
            const duration = Date.now() - start;
            console.log(`[TEST] Result length: ${result.length} chars`);
            console.log(`[TEST] Time taken: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
        } catch (error: any) {
            const duration = Date.now() - start;
            console.log(`[TEST] Failed after ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
            console.log(`[TEST] Error: ${error.message}`);
        }
    }
}

testPerformance().catch(console.error);
