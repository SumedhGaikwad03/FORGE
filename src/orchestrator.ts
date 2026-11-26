import { executeAgent } from "./agent";

const MAX_DEPTH = 4;


// Creates and manages the agent hierarchy

async function runNode(
  task: string,
  currentDepth: number
): Promise<string> {

  console.log(
    `\nOrchestrator starting agent at depth ${currentDepth}`
  );

  try {
    // here is where actully the first agent start now as this is the call to the first agent now 
    const result = await executeAgent(
      task,
      currentDepth,

      // Give the agent a delegation capability.
      // The callback returns control to the orchestrator.
      async (childTask: string) => {

        if (currentDepth >= MAX_DEPTH) {
          return `Error: Maximum delegation depth (${MAX_DEPTH}) reached. Cannot delegate further.`;
        }

        console.log(
          `Orchestrator delegating from ${currentDepth} to ${currentDepth + 1}`
        );

        return await runNode(
          childTask,
          currentDepth + 1
        );
      },

      currentDepth <  MAX_DEPTH 
    );

    if (!result || typeof result !== "string" || !result.trim()) {
      return `Error: Agent at depth ${currentDepth} returned empty or invalid output.`;
    }

    return result.trim();
  } catch (err: any) {
    return `Error: Agent execution at depth ${currentDepth} failed: ${err.message || String(err)}`;
  }
}


// Public entry point

export async function runMainAgent(task: string) {

  return await runNode(task, 0);

}