const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");
const { executeCrossChainSwap } = require('./index.js');
const https = require('https');
const env = require('dotenv');
const process = env.config().parsed;

// Initialize MCP server with name/version
const server = new McpServer({
    name: "1inch-CrossChain-Swap",
    version: "1.0.0"
});

/**
 * Generic API fetcher for 1inch Portfolio service
 * @param {string} endpoint - Path after base API URL
 * @param {number} chainId - Blockchain chain ID
 * @param {object} queryParams - Extra query params as key-value pairs
 */
const makePortfolioApiRequest = (endpoint, chainId, queryParams = {}) => {
    return new Promise((resolve, reject) => {
        const apiUrl = new URL(`https://api.1inch.dev/portfolio/portfolio/v4${endpoint}`);

        // Always append chain_id
        apiUrl.searchParams.append('chain_id', chainId);

        // Append any provided extra params
        Object.entries(queryParams).forEach(([key, value]) => {
            apiUrl.searchParams.append(key, value);
        });

        const options = {
            headers: {
                'Authorization': `Bearer ${"C5Y1zZpwxSL8IizlPO4TeGXooOdtUg5D" || ''}`,
                'accept': 'application/json',
                'content-type': 'application/json'
            }
        };

        const req = https.get(apiUrl, options, (res) => {
            let body = '';

            res.on('data', chunk => {
                body += chunk;
            });

            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(body));
                    } catch (parseErr) {
                        reject(new Error(`JSON parse failed: ${parseErr.message}`));
                    }
                } else {
                    reject(new Error(`Request failed: ${res.statusCode} - ${body}`));
                }
            });
        });

        req.on('error', err => reject(err));
        req.end();
    });
};

// Tool: swap - executes cross-chain swap
server.tool(
    "swap",
    {
        srcChainId: z.number().optional().default(8453),
        dstChainId: z.number().optional().default(42161),
        srcTokenAddress: z.string().optional().default('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'),
        dstTokenAddress: z.string().optional().default('0xaf88d065e77c8cC2239327C5EDb3A432268e5831'),
        amount: z.string().optional().default('1000000'),
        invert: z.boolean().optional().default(false)
    },
    async (params) => {
        try {
            let amount = params.amount;
            if (!isNaN(Number(amount)) && Number(amount) < 1e6) {
                amount = (Number(amount) * 1e6).toString();
            }
            params.amount = amount;

            const result = await executeCrossChainSwap(params);

            return {
                content: [{
                    type: "text",
                    text: result
                        ? `Swap initiated successfully! Order hash: ${result.orderHash}\n${result.message}`
                        : `Swap failed: ${result.error}`
                }]
            };
        } catch (err) {
            return {
                content: [{ type: "text", text: `Error: ${err.message}` }],
                isError: true
            };
        }
    }
);

// Resource: swap-status (URI form)
server.resource(
    "swap-status",
    "swaps://{orderHash}",
    async (uri) => {
        const fs = require('fs');
        const path = require('path');

        const orderHash = uri.pathname.replace(/^\//, '');
        const statusFile = path.join(__dirname, 'order-status.json');

        if (!fs.existsSync(statusFile)) {
            return { contents: [{ uri: uri.href, text: `No swap orders found.` }] };
        }

        try {
            const data = JSON.parse(fs.readFileSync(statusFile, 'utf8'));

            if (!orderHash) {
                const ordersText = data.orders.map(o =>
                    `Order: ${o.orderHash}\nStatus: ${o.status}\nStart Time: ${new Date(o.startTime).toLocaleString()}\nLast Updated: ${new Date(o.lastUpdated).toLocaleString()}`
                ).join('\n\n');

                return {
                    contents: [{
                        uri: uri.href,
                        text: ordersText || 'No orders found.'
                    }]
                };
            }

            const order = data.orders.find(o => o.orderHash === orderHash);
            if (!order) {
                return { contents: [{ uri: uri.href, text: `Order ${orderHash} not found.` }] };
            }

            return {
                contents: [{
                    uri: uri.href,
                    text: `Order: ${orderHash}\nStatus: ${order.status}\nStart Time: ${new Date(order.startTime).toLocaleString()}\nLast Updated: ${new Date(order.lastUpdated).toLocaleString()}`
                }]
            };
        } catch (err) {
            return {
                contents: [{ uri: uri.href, text: `Error reading swap status: ${err.message}` }]
            };
        }
    }
);

// Tool: portfolio-protocols-value
server.tool(
    "portfolio-protocols-value",
    {
        chainId: z.number().default(1),
        addresses: z.string().optional(),
        use_cache: z.boolean().optional().default(false)
    },
    async (params) => {
        try {
            const queryParams = {
                addresses: params.addresses,
                use_cache: params.use_cache.toString()
            };
            const result = await makePortfolioApiRequest('/overview/protocols/current_value', params.chainId, queryParams);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
            return { content: [{ type: "text", text: `Error fetching protocols value: ${err.message}` }], isError: true };
        }
    }
);

// Tool: portfolio-tokens-details
server.tool(
    "portfolio-tokens-details",
    {
        chainId: z.number().default(1),
        addresses: z.string().optional(),
        timerange: z.enum(['1day', '1week', '1month', '1year', '3years']).optional().default('1day'),
        closed: z.boolean().default(true),
        closed_threshold: z.number().default(1),
        use_cache: z.boolean().optional().default(false)
    },
    async (params) => {
        try {
            const queryParams = {
                addresses: params.addresses,
                timerange: params.timerange,
                closed: params.closed.toString(),
                closed_threshold: params.closed_threshold.toString(),
                use_cache: params.use_cache.toString()
            };
            const result = await makePortfolioApiRequest('/overview/erc20/details', params.chainId, queryParams);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
            return { content: [{ type: "text", text: `Error fetching tokens details: ${err.message}` }], isError: true };
        }
    }
);

// Tool: portfolio-general-value
server.tool(
    "portfolio-general-value",
    {
        chainId: z.number().default(1),
        addresses: z.string().optional(),
        use_cache: z.boolean().optional().default(false)
    },
    async (params) => {
        try {
            const queryParams = {
                addresses: params.addresses,
                use_cache: params.use_cache.toString()
            };
            const result = await makePortfolioApiRequest('/general/current_value', params.chainId, queryParams);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
            return { content: [{ type: "text", text: `Error fetching general value: ${err.message}` }], isError: true };
        }
    }
);

// Tool: portfolio-value-chart
server.tool(
    "portfolio-value-chart",
    {
        chainId: z.number().default(1),
        addresses: z.string().optional(),
        timerange: z.enum(['1day', '1week', '1month', '1year', '3years']).optional().default('1month'),
        use_cache: z.boolean().optional().default(false)
    },
    async (params) => {
        try {
            const queryParams = {
                addresses: params.addresses,
                timerange: params.timerange,
                use_cache: params.use_cache.toString()
            };
            const result = await makePortfolioApiRequest('/general/value_chart', params.chainId, queryParams);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
            return { content: [{ type: "text", text: `Error fetching value chart: ${err.message}` }], isError: true };
        }
    }
);

// Tool: swap-status (non-URI)
server.tool(
    "swap-status",
    { orderHash: z.string().optional() },
    async (params) => {
        const fs = require('fs');
        const path = require('path');
        const statusFile = path.join(__dirname, 'order-status.json');

        if (!fs.existsSync(statusFile)) {
            return { content: [{ type: "text", text: `No swap orders found.` }] };
        }

        try {
            const data = JSON.parse(fs.readFileSync(statusFile, 'utf8'));

            if (!params.orderHash) {
                if (data.orders.length === 0) {
                    return { content: [{ type: "text", text: `No orders found.` }] };
                }
                const ordersText = data.orders.map(o =>
                    `Order: ${o.orderHash}\nStatus: ${o.status}\nStart Time: ${new Date(o.startTime).toLocaleString()}\nLast Updated: ${new Date(o.lastUpdated).toLocaleString()}`
                ).join('\n\n');
                return { content: [{ type: "text", text: ordersText }] };
            }

            const order = data.orders.find(o => o.orderHash === params.orderHash);
            if (!order) {
                return { content: [{ type: "text", text: `Order ${params.orderHash} not found.` }] };
            }

            return {
                content: [{
                    type: "text",
                    text: `Order: ${params.orderHash}\nStatus: ${order.status}\nStart Time: ${new Date(order.startTime).toLocaleString()}\nLast Updated: ${new Date(order.lastUpdated).toLocaleString()}`
                }]
            };
        } catch (err) {
            return { content: [{ type: "text", text: `Error reading swap status: ${err.message}` }], isError: true };
        }
    }
);

// Launch MCP server on stdio transport
const transport = new StdioServerTransport();
(async () => {
    await server.connect(transport);
})();
