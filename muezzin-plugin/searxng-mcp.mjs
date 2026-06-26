import readline from 'readline';
import http from 'http';
import { URL } from 'url';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function sendResponse(id, result) {
  const response = {
    jsonrpc: "2.0",
    id,
    result
  };
  process.stdout.write(JSON.stringify(response) + "\n");
}

function sendError(id, code, message) {
  const response = {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message
    }
  };
  process.stdout.write(JSON.stringify(response) + "\n");
}

const TOOLS = [
  {
    name: "searxng_web_search",
    description: "Search the web using SearXNG. Use this tool to search for documentation, code examples, API details, and to ground decisions.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query"
        }
      },
      required: ["query"]
    }
  }
];

function performSearch(query) {
  return new Promise((resolve, reject) => {
    const rawUrl = process.env.SEARXNG_URL || 'http://nxtbeast:8080';
    const baseUrl = rawUrl.endsWith('/') ? rawUrl : rawUrl + '/';
    const searchUrl = new URL(`${baseUrl}search?q=${encodeURIComponent(query)}&format=json`);
    
    console.error(`[searxng-mcp] Searching: ${searchUrl.toString()}`);
    
    http.get(searchUrl.toString(), (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse JSON response: ${e.message}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function handleRequest(req) {
  const { method, params, id } = req;

  if (method === "initialize") {
    sendResponse(id, {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: "searxng-mcp",
        version: "1.0.0"
      }
    });
    return;
  }

  if (method === "tools/list") {
    sendResponse(id, {
      tools: TOOLS
    });
    return;
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params || {};
    
    if (name === "searxng_web_search") {
      const query = args.query;
      try {
        const results = await performSearch(query);
        const list = (results.results || []).slice(0, 10).map((r, i) => {
          return `${i+1}. ${r.title}\nURL: ${r.url}\nSummary: ${r.content || ''}\n`;
        }).join('\n');
        
        sendResponse(id, {
          content: [
            {
              type: "text",
              text: list || "No results found."
            }
          ],
          isError: false
        });
      } catch (err) {
        sendResponse(id, {
          content: [
            {
              type: "text",
              text: `Search error: ${err.message}`
            }
          ],
          isError: true
        });
      }
      return;
    }

    sendError(id, -32601, `Tool not found: ${name}`);
    return;
  }

  // Ignore notifications or send standard error for other unsupported requests
  if (id !== undefined) {
    sendError(id, -32601, `Method not found: ${method}`);
  }
}

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const request = JSON.parse(line);
    handleRequest(request);
  } catch (err) {
    sendError(null, -32700, "Parse error: " + err.message);
  }
});

console.error("[searxng-mcp] SearXNG stdio MCP Server started.");
