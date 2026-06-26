import readline from 'readline';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    name: "conduct_cycle",
    description: "Run conduct-cycle.mjs to perform orientation, check daemon status, and list required actions.",
    inputSchema: {
      type: "object",
      properties: {
        json: {
          type: "boolean",
          description: "Output in JSON format"
        }
      }
    }
  },
  {
    name: "run_mission",
    description: "Run a specific mission txt file in a workspace cwd.",
    inputSchema: {
      type: "object",
      properties: {
        mission_path: {
          type: "string",
          description: "Path to the mission file relative to muezzin-plugin or absolute path"
        },
        cwd: {
          type: "string",
          description: "Absolute path to workspace directory"
        }
      },
      required: ["mission_path", "cwd"]
    }
  },
  {
    name: "orchestrate",
    description: "Orchestrate a new mission directly from a maqsad and niyyah string.",
    inputSchema: {
      type: "object",
      properties: {
        maqsad: {
          type: "string",
          description: "Objective statement + Niyyah statement"
        },
        cwd: {
          type: "string",
          description: "Optional workspace directory (creates a fresh sandbox if omitted)"
        }
      },
      required: ["maqsad"]
    }
  },
  {
    name: "doctor",
    description: "Run the doctor.mjs self-diagnostics.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "record_fix",
    description: "Record a landed fix in the fix ledger to requeue failed missions.",
    inputSchema: {
      type: "object",
      properties: {
        cls: {
          type: "string",
          description: "Failure class (e.g. empty-thinking, wudu-violation)"
        },
        fix: {
          type: "string",
          description: "What fix was applied to resolve it"
        },
        requeue: {
          type: "array",
          items: {
            type: "string"
          },
          description: "List of mission stems to requeue"
        }
      },
      required: ["cls", "fix"]
    }
  }
];

function runCommand(cmd) {
  return new Promise((resolve) => {
    console.error(`[muezzin-mcp] Executing: ${cmd}`);
    exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout,
        stderr,
        code: error ? error.code : 0
      });
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
        name: "muezzin-mcp",
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
    
    if (name === "conduct_cycle") {
      const flag = args && args.json ? " --json" : "";
      const res = await runCommand(`node conduct-cycle.mjs${flag}`);
      sendResponse(id, {
        content: [
          {
            type: "text",
            text: res.stdout || res.stderr || "(No output)"
          }
        ],
        isError: !res.ok
      });
      return;
    }

    if (name === "run_mission") {
      const mPath = args.mission_path;
      const cwd = args.cwd;
      const res = await runCommand(`node run-mission.mjs "${mPath}" "${cwd}"`);
      sendResponse(id, {
        content: [
          {
            type: "text",
            text: `Stdout:\n${res.stdout}\n\nStderr:\n${res.stderr}`
          }
        ],
        isError: !res.ok
      });
      return;
    }

    if (name === "orchestrate") {
      const maqsad = args.maqsad;
      const cwd = args.cwd ? ` "${args.cwd}"` : "";
      const res = await runCommand(`node orchestrate-cli.mjs "${maqsad.replace(/"/g, '\\"')}"${cwd}`);
      sendResponse(id, {
        content: [
          {
            type: "text",
            text: `Stdout:\n${res.stdout}\n\nStderr:\n${res.stderr}`
          }
        ],
        isError: !res.ok
      });
      return;
    }

    if (name === "doctor") {
      const res = await runCommand(`node doctor.mjs`);
      sendResponse(id, {
        content: [
          {
            type: "text",
            text: res.stdout || res.stderr || "(No output)"
          }
        ],
        isError: !res.ok
      });
      return;
    }

    if (name === "record_fix") {
      const cls = args.cls;
      const fix = args.fix;
      const requeueStems = args.requeue && args.requeue.length ? ` --requeue ${args.requeue.join(",")}` : "";
      const res = await runCommand(`node conduct-cycle.mjs --record --class "${cls.replace(/"/g, '\\"')}" --fix "${fix.replace(/"/g, '\\"')}"${requeueStems}`);
      sendResponse(id, {
        content: [
          {
            type: "text",
            text: res.stdout || res.stderr || "(No output)"
          }
        ],
        isError: !res.ok
      });
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

console.error("[muezzin-mcp] Stdio MCP Server started.");
