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

  return await executeAgent(
    task,
    currentDepth,

    // Give the agent a delegation capability.
    // The callback returns control to the orchestrator.
    async (childTask: string) => {

      if (currentDepth >= MAX_DEPTH) {
        return "Maximum delegation depth reached.";
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
}


// Public entry point

export async function runMainAgent(task: string) {

  return await runNode(task, 0);

}