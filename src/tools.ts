import { $ } from "bun";
//import { runSubAgent } from "./agent";
import type { MaxPrice } from "@openrouter/sdk/models";
import type { Tool } from "@openrouter/agent";




// this is specifiaclly usefull for thr variable depth in the  ai agent 

//const Max_depth = 4 ; 
// the max depth function is needed in the orcharater layer 


// we define the tool context here that other functions can use 
type ToolContext = {
  currentDepth: number;
  delegateTask: (task: string) => Promise<string>;
}; 



export function createToolHandlers(Context : ToolContext){
  // Track delegated tasks to prevent repeated delegation of completed tasks and infinite retry loops
  const taskHistory = new Map<
    string,
    {
      result: string;
      completed: boolean;
      attempts: number;
      lastFailureReason?: string;
    }
  >();

  const MAX_RETRY_ATTEMPTS = 2;

  function strKey(str: string): string {
    return str.toLowerCase().replace(/[^\w\s]/g, "").trim().replace(/\s+/g, " ");
  }

  const toolHandlers: Record<
    string,
    (args: any) => Promise<string>
  > = {

    // no tools can create there own sub agent all it can do is delegate tasks here 
  run_bash: async (args: { command: string }) => {
    console.log("\nRunning Bun Shell:", args.command);

    try {
      const output = await $`${{ raw: args.command }}`.nothrow().quiet();
      const stdout = output.stdout.toString().trim();
      const stderr = output.stderr.toString().trim();

      if (output.exitCode !== 0) {
        return `Command failed (exit code ${output.exitCode}): ${stderr || stdout || "Unknown error"}`;
      }

      return stdout || stderr || "Command executed with no output";
    } catch (err: any) {
      return `Command failed: ${err.message}`;
    }
  },

  run_sub_agent: async (args: any) => {
    // 1. Validate that args.task exists and is a non-empty string
    if (!args || typeof args.task !== "string" || !args.task.trim()) {
      return "Error: Invalid task argument. The 'task' argument must be a non-empty string, not an object or empty value.";
    }

    const task = args.task.trim();
    const taskKey = strKey(task);
    const existing = taskHistory.get(taskKey);

    // 2. Safeguard: Do not retry a completed task
    if (existing && existing.completed) {
      console.log(`[Depth ${Context.currentDepth}] Task already completed. Skipping re-delegation: "${task}"`);
      return `Task is already COMPLETED. Previous result:\n${existing.result}\nDo not re-delegate this task. Use the existing result to synthesize your final response.`;
    }

    // 3. Safeguard: Limit repeated attempts for the same failed task
    if (existing && existing.attempts >= MAX_RETRY_ATTEMPTS) {
      console.log(`[Depth ${Context.currentDepth}] Retry limit reached for task: "${task}"`);
      return `Error: Delegation retry limit reached (${MAX_RETRY_ATTEMPTS} attempts). Last failure reason: ${existing.lastFailureReason || "Unknown failure"}. Do not retry this task; report this failure in your final response.`;
    }

    const currentAttempt = (existing?.attempts ?? 0) + 1;
    console.log(`\nDelegating task from depth ${Context.currentDepth} (attempt ${currentAttempt}): "${task}"`);

    try {
      const result = await Context.delegateTask(task);

      if (!result || typeof result !== "string" || !result.trim()) {
        const failureMsg = "Error: Child agent completed with no output or empty result.";
        taskHistory.set(taskKey, {
          result: failureMsg,
          completed: false,
          attempts: currentAttempt,
          lastFailureReason: failureMsg,
        });
        return failureMsg;
      }

      const trimmedResult = result.trim();
      const isFailed =
        trimmedResult.startsWith("Error:") ||
        trimmedResult.startsWith("Command failed:") ||
        trimmedResult.startsWith("Delegation failed:") ||
        (/\bFAILED\b/i.test(trimmedResult) && !/\bCOMPLETED\b/i.test(trimmedResult));

      taskHistory.set(taskKey, {
        result: trimmedResult,
        completed: !isFailed,
        attempts: currentAttempt,
        lastFailureReason: isFailed ? trimmedResult : undefined,
      });

      return trimmedResult;
    } catch (err: any) {
      const errorMsg = `Delegation failed: ${err.message || String(err)}`;
      taskHistory.set(taskKey, {
        result: errorMsg,
        completed: false,
        attempts: currentAttempt,
        lastFailureReason: errorMsg,
      });
      return errorMsg;
    }
  },

  search_web: async (args: { query: string }) => {
    try {
      if (!process.env.TAVILY_API_KEY) {
        return "Search failed: TAVILY_API_KEY environment variable is not configured.";
      }

      const response = await fetch(
        "https://api.tavily.com/search",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: args.query,
            search_depth: "basic",
            max_results: 5
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return `Search API error (${response.status}): ${errorText}`;
      }

      const data: any = await response.json();
      return JSON.stringify(data.results ?? []) || "No results found.";
    } catch (err: any) {
      return `Search failed: ${err.message}`;
    }
  },

  get_weather: async (args: { city: string }) => {
    console.log("\nFetching weather for:", args.city);

    try {
      const res = await fetch(
        `https://wttr.in/${encodeURIComponent(args.city)}?format=3`
      );

      if (!res.ok) {
        return `Weather API error: ${res.status}`;
      }

      return (await res.text()).trim();
    } catch (err: any) {
      return `Failed to fetch weather: ${err.message}`;
    }
  },

};
 return toolHandlers ;
}



export const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the current weather for a city",
      parameters: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "City name",
          },
        },
        required: ["city"],
      },
    },
  },


  {
    type: "function",
    function: {
      name: "run_bash",
      description:
        "Execute a shell or bash command using Bun's cross-platform shell environment.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to execute (e.g. ls, cat, echo, grep, etc.).",
          },
        },
        required: ["command"],
      },
    },
  },

  {
  type: "function",
  function: {
    name: "run_sub_agent",
    description:
      "Delegate a task to a child FORGE agent. The child executes the task and returns its result.",
    parameters: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description:
            "The task the child agent must complete, including necessary context and requirements."
        }
      },
      required: ["task"]
    }
  }
},
{
  type: "function",
  function: {
    name: "search_web",
    description:
      "Search the internet for information and return relevant web results.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query"
        }
      },
      required: ["query"]
    }
  }
},
]; 
