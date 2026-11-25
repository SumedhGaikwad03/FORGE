import { $ } from "bun";
import { runSubAgent } from "./agent";



export const toolHandlers: Record<
  string,
  (args: any) => Promise<string>
> = {

  run_bash: async (args: { command: string }) => {
    console.log("\nRunning PowerShell:", args.command);

    try {
      const output = await $`powershell.exe -NoProfile -Command ${args.command}`.text();

      return output.trim() || "Command executed with no output";
    } catch (err: any) {
      return `Command failed: ${err.message}`;
    }
  },

  run_sub_agent : async (args : { task : string})=> {

    console.log(`\n This is used to create an subagent for a task , the task given is ${args.task}`);

    try {

      const result = await runSubAgent(args.task);
      return JSON.stringify(result) || "Command executed with no output";
    }
    catch(err:any){

      return `Command failed because ${err.message}`;
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
]; 
