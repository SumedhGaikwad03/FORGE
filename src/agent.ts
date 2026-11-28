import { readStreamingResponse } from "./stream";
import { createToolHandlers, tools } from "./tools";
import { Blackboard } from "./blackboard";
import { getSystemPrompt, formatSharedKnowledge } from "./prompts";

const path: string = String.raw`C:\Users\777su\Desktop\claudeMini\hello.txt`;

export const messages: any[] = [
  {
    role: "user",
    content: `
  Test the recursive delegation system.

  That sub-agent must delegate the task to another
  sub-agent, and continue until maximum depth is reached.

  The deepest agent must use search_web to find the facts.

  Each parent must wait for its child, inspect the
  returned result, and pass a summary to its own parent.

  Return the final combined result.
`,
  },
];

// this is the function that is responsible for the excuting the task this is basically an agent here

export async function executeAgent(
  task: string,
  currentDepth: number,
  delegateTask: (task: string) => Promise<string>,
  canDelegate: boolean,
  // pass the current blackboard instance to the agent here
  blackboard?: Blackboard,
) {
  // this gets the system prompt for the agent based on whether it is depth 0 or a sub agent
  const systemPrompt = getSystemPrompt(currentDepth);

  // this array that is used for the process of agent messages that is given to a sub agent in the
  // in the file system

  // here we format and inject the shared blackboard knowledge if this is a sub agent (depth > 0)
  const blackboardContext =
    blackboard && currentDepth > 0 && blackboard.getAllFindings().length > 0
      ? formatSharedKnowledge(blackboard.getSnapshot())
      : "";

  const agentMessages: any[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      // this is the task that we sent to the user on which it can iterate and work upon
      // this is the part that the agent actually works upon now
      content: `${task}${blackboardContext}`,
    },
  ];

  // this is used to fetch tool handelers that supports each tool execution one by one

  const toolHandlers = createToolHandlers({
    currentDepth,
    delegateTask,
  });

  // we check if we can delate to the sub agent else any tool can be called for the agent
  // we block the tool that is called as the run_sub_agent here

  let availableTools;

  if (currentDepth === 0) {
    // the only tool you have is to delegate the execution to
    // another agent
    availableTools = tools.filter(
      (tool) => tool.function.name === "run_sub_agent",
    );
  } else if (!canDelegate) {
    availableTools = tools.filter(
      (tool) => tool.function.name !== "run_sub_agent",
    );
  } else {
    availableTools = tools;
  }

  console.log(`Starting agent at depth ${currentDepth}`);

  while (true) {
    console.log(
      `\n\n[Agent Depth ${currentDepth}] Sending request to OpenRouter...\n`,
    );

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",

      headers: {
        Authorization: `Bearer ${process.env.API_KEY}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        model: "z-ai/glm-5.3-flash",
        messages: agentMessages,

        // these are the same tools that are avalilabe for the agent to execute
        tools: availableTools,
        tool_choice: "auto",
        // the model sends you small chunks as it genrated them
        // sends as SSE "server side events in the loop"
        stream: true,

        // this tell the open router that to send us token limits
        stream_options: {
          include_usage: true,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`API ERROR ${res.status}: ${await res.text()}`);
    }

    // only stream live tokens to stdout if this is the root coordinator at depth 0
    // for sub agents we keep them silent so they don't garble the terminal output
    const shouldStream = currentDepth === 0;
    const assistantMessage = await readStreamingResponse(res, shouldStream);

    // this is the tool call by the internal redis string
    console.log(
      "\n\nTool calls in this response:",
      assistantMessage.tool_calls?.length ?? 0,
    );

    // Push assistant response into conversation
    agentMessages.push(assistantMessage);

    // this point the first call is completed here

    // if no tools are called then return the final response
    if (
      !assistantMessage.tool_calls ||
      assistantMessage.tool_calls.length === 0
    ) {
      if (!assistantMessage.content || !assistantMessage.content.trim()) {
        return "Error: Agent finished without providing any output or completion status.";
      }
      return assistantMessage.content.trim();
    }
    // console.log("The agent has finished the first loop for iteration ")

    // Parallel execution: execute all tool calls in this response concurrently
    // this will fire the req at the exactly same millisecond
    const toolResults = await Promise.all(
      assistantMessage.tool_calls.map(async (call: any) => {
        const toolName = call.function.name;

        let args: any;

        try {
          args = JSON.parse(call.function.arguments);
        } catch {
          console.error("Invalid tool arguments:", call.function.arguments);

          return {
            role: "tool",
            tool_call_id: call.id,
            content: "Error: Invalid JSON arguments",
          };
        }

        const isPermitted = availableTools.some(
          (t) => t.function.name === toolName,
        );

        // store the  call back functiion the variable as const that will be later used to call the tools
        const handler = isPermitted ? toolHandlers[toolName] : null;

        console.log(
          `\nTool called: ${toolName}`,
          JSON.stringify(args, null, 2),
        );

        const rawResult = handler
          ? await handler(args)
          : `Error: Tool "${toolName}" is not permitted at depth ${currentDepth}`;

        const result =
          typeof rawResult === "string" && rawResult.trim()
            ? rawResult.trim()
            : "Error: Tool executed but returned an empty or invalid result.";

        console.log(`Agent depth ${currentDepth} executed ${toolName}`);

        // Send tool result back to model
        return {
          role: "tool",
          tool_call_id: call.id,
          content: result,
        };
      }),
    );

    // this marks the end of the promise all arch as this will have all the tool requests in itself
    // concurrently right ?

    // Push all tool results into conversation
    agentMessages.push(...toolResults);

    console.log("\nTool execution completed. Starting next cycle...");
  }
}
