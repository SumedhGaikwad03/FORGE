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
  const toolHandlers: Record<
    string,
    (args: any) => Promise<string>
  > = {

    // no tools can create there own sub agent all it can do is delegate tasks here 
  run_bash: async (args: { command: string }) => {
    console.log("\nRunning PowerShell:", args.command);

    try {
      const output = await $`powershell.exe -NoProfile -Command ${args.command}`.text();

      return output.trim() || "Command executed with no output";
    } catch (err: any) {
      return `Command failed: ${err.message}`;
    }
  },

  run_sub_agent : async (args : { task : string  })=> {

    console.log(`\n This is used to create an subagent for a task , the task given is ${args.task}`);

     console.log(`Delegation requested from depth ${Context.currentDepth}`);
    try {

      const result = await Context.delegateTask(args.task) ;
      return result || "Command executed with no output";
    }
    catch(err:any){

      return `Command failed because ${err.message}`;
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
        "Execute commands using Windows PowerShell syntax",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The PowerShell command to execute",
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
      "Delegate a task to an independent AI sub-agent. The sub-agent can use its permitted tools and returns a summary of its work.",
    parameters: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description:
            "Describe the specific task that the sub-agent should complete."
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
