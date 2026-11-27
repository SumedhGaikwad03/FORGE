import { runMainAgent } from "./src/orchestrator";

async function main() {
  const result = await runMainAgent(`
You have 5 distinct tasks to complete. Delegate ALL 5 tasks simultaneously to 5 separate sub-agents in parallel using \`run_sub_agent\`:

1. Live Weather Check (External API):
   - Get the current live weather for Pune and Tokyo.

2. Project File Discovery (Shell I/O):
   - List all files in the current working directory and count how many TypeScript (.ts) files exist.

3. File Inspection & Reading (Local Filesystem):
   - Find and read "hello.txt", and execute the task given in that file 

4. Real-Time Tech Research (Web Search API):
   - Search the web for the latest NVIDIA Blackwell or GPU architecture announcements.

5. System Environment Audit (Host Inspection):
   - Run a command to report the current Bun runtime version, operating system architecture, and current working directory path.

Rules:
- Do not execute any of these operational tasks yourself; assign each one to its own dedicated sub-agent.
- Delegate all 5 tasks in parallel so they can execute concurrently.
- Collect the results from all 5 sub-agents and return a consolidated final summary with a structured markdown report.
`);

  console.log("\n=================== FINAL CONSOLIDATED RESULT ===================");
  console.log(result);
  console.log("=================================================================\n");
}

main().catch((err: any) => {
  console.error("\nAgent failed:", err.message);
});