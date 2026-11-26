import { executeAgent } from "./src/agent";
export { API_KEY } from "./src/config";
export { readStreamingResponse } from "./src/stream";
export { createToolHandlers, tools } from "./src/tools";
export { executeAgent } from "./src/agent";


import { runMainAgent } from "./src/orchestrator";

async function main() {


const result = await runMainAgent(`
You have 3 tasks to complete. Delegate each task to a separate sub-agent using \`run_sub_agent\`:

1. Weather Check:
   - Get the current weather for Pune and Delhi.

2. Shell Execution:
   - Run a command to list all files in the current working directory.

3. File Task:
   - Find and read "hello.txt", then execute the instructions written inside it.

Rules:
- Do not execute these tasks yourself; assign each one to its own sub-agent.
- Collect the results from all 3 sub-agents and return a clean, consolidated summary.
`);


console.log("\nFINAL RESULT:\n", result);
 }
main().catch((err: any) => {
  console.error("\nAgent failed:", err.message);
})
