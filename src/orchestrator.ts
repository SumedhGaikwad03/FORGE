import { executeAgent } from "./agent";
import { Blackboard } from "./blackboard";

const MAX_DEPTH = 4;
 const blackboard = new Blackboard(); 


// Creates and manages the agent hierarchy in the entire project here 
// this makes sure that we have mutiple sub agents that run through the system in 
// a node here runs that makes sure that the another call gets executed 

// this is a node as  each node in the project had its own context and the access to the available tools 

async function runNode(
  task: string,
  currentDepth: number,
  // we pass the black board as an param into the run node function 
  blackboard: Blackboard
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
      // this is essenatlly the delgate task function that we pass along the function 
      // The callback returns control to the orchestrator. 
      // this means that an agent can call and use this function to make more agents 
      async (childTask: string) => {

        if (currentDepth >= MAX_DEPTH) {
          return `Error: Maximum delegation depth (${MAX_DEPTH}) reached. Cannot delegate further.`;
        }

        console.log(
          `Orchestrator delegating from ${currentDepth} to ${currentDepth + 1}`
        );

        return await runNode(
          childTask,
          currentDepth + 1,
          blackboard
        );
      },

      currentDepth <  MAX_DEPTH,
      blackboard
    );

    if (!result || typeof result !== "string" || !result.trim()) {
      return `Error: Agent at depth ${currentDepth} returned empty or invalid output.`;
    }

    const trimmed = result.trim();

    // we have the result for the current agent 
    // Automatically record sub-agent findings to the blackboard 

    // this is for other agents to find out 
    if (currentDepth > 0 && !trimmed.startsWith("Error:")) {
      blackboard.addFinding(task, trimmed);
    }

   console.log("\n--- BLACKBOARD SNAPSHOT ---");
console.log(blackboard.getSnapshot());
console.log("---------------------------\n");

    return trimmed;
  } catch (err: any) {
    return `Error: Agent execution at depth ${currentDepth} failed: ${err.message || String(err)}`;
  }
}


// Public entry point

export async function runMainAgent(task: string) {
 
  return await runNode(task, 0, blackboard);
}

// this is an function to reset the session 

export function clearSession (){

  blackboard.clear();
}