import { readStreamingResponse } from "./stream";
import { createToolHandlers, tools } from "./tools";
import { Blackboard } from "./blackboard";

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
`
  }
];

// this is the function that is responsible for the excuting the task this is basically an agent here 

export async function executeAgent(task : string ,
  currentDepth : number , 
  delegateTask : (task :string) => Promise<string>,
  canDelegate : boolean,
  // pass the current blackboard instance to the agent here 
  blackboard?: Blackboard
) {

  // this is an system promt for thr agent itself here 


  const systemPrompt = currentDepth === 0
    ? `You are FORGE, the root coordinator.

Your job is to plan tasks, delegate them to subagents, track their results, and provide the final response.

Rules:
1. Break the user's request into clear, independent tasks.
2. Delegate tasks using run_sub_agent.
3. Give each subagent all context and requirements it needs.
4. Track which tasks are complete, failed, or incomplete.
5. Do not perform operational tasks yourself.
6. Do not assume a task succeeded. Check the subagent's result.
7. Combine the results into one accurate response.
8. Never claim work was completed without evidence.

Keep delegation focused. Do not create unnecessary subtasks.`
    : `You are a FORGE execution agent.

Your job is to complete the task assigned by the parent agent.

Rules:
1. Understand the task before using tools.
2. Use the available tools to perform the requested work.
3. Use actual command syntax supported by the execution environment.
4. Always communicate and respond in English.
5. You are executing in the project root directory (./). Always check the current working directory first using cat or ls before searching elsewhere.
6. Reuse file paths and results discovered earlier. Never invent paths.
7. Complete all required steps, not just the first step.
8. Verify important actions before reporting success.
9. If something fails, try a reasonable correction.
10. Do not claim success without evidence.
11. Delegate only if run_sub_agent is available and delegation is genuinely useful.
12. Report the result clearly.

End your response with one status:
COMPLETED
PARTIALLY COMPLETED
FAILED

Include a short explanation and evidence for the status.`;

// this array that is used for the process of agent messages that is given to a sub agent in the 
// in the file system 

  // Inject shared blackboard knowledge for sub-agents (depth > 0)
  const blackboardContext =
    blackboard && currentDepth > 0 && blackboard.getAllFindings().length > 0
      ? `\n\n[SHARED KNOWLEDGE FROM PREVIOUS & SIBLING AGENTS]:\n${blackboard.getSnapshot()}`
      : "";

  const agentMessages: any[] = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      // this is the task that we sent to the user on which it can iterate and work upon 
      // this is the part that the agent actually works upon now 
      content: `${task}${blackboardContext}`
    }
  ];

// this is used to fetch tool handelers that supports each tool execution one by one 

    const toolHandlers = createToolHandlers({
    currentDepth,
    delegateTask
  });

  // we check if we can delate to the sub agent else any tool can be called for the agent 
  // we block the tool that is called as the run_sub_agent here 

  let availableTools ; 

  if(currentDepth === 0){

    // the only tool you have is to delegate the execution to
    // another agent 
    availableTools = tools.filter(tool => 
      tool.function.name === "run_sub_agent"
    );

  }else if (!canDelegate){

    availableTools = tools.filter(tool =>
       tool.function.name !== "run_sub_agent");
  } else {

    availableTools = tools ; 
  }

 

   console.log(`Starting agent at depth ${currentDepth}`); 

  while (true) {

    console.log(`\n\n[Agent Depth ${currentDepth}] Sending request to OpenRouter...\n`);

    const res = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",

        headers: {
        Authorization: `Bearer ${process.env.API_KEY}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          model: "z-ai/glm-5.3-flash",
          messages : agentMessages,

          // these are the same tools that are avalilabe for the agent to execute 
          tools : availableTools,
          tool_choice: "auto",
          // the model sends you small chunks as it genrated them 
          // sends as SSE "server side events in the loop"
          stream: true,
        }),
      }
    );

    if (!res.ok) {
      throw new Error(
        `API ERROR ${res.status}: ${await res.text()}`
      );
    }

    // Read streamed response the response that is given by the model is captured here
    // and printed to the terminal  
    // and sent here for futher processing 
    const assistantMessage = await readStreamingResponse(res);

      // this is the tool call by the internal redis string 
    console.log(
      "\n\nTool calls in this response:",
      assistantMessage.tool_calls?.length ?? 0 
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
          console.error(
            "Invalid tool arguments:",
            call.function.arguments
          );

          return {
            role: "tool",
            tool_call_id: call.id,
            content: "Error: Invalid JSON arguments",
          };
        }

        const isPermitted = availableTools.some(t => t.function.name === toolName);

        // store the  call back functiion the variable as const that will be later used to call the tools 
        const handler = isPermitted ? toolHandlers[toolName] : null;

        console.log(
          `\nTool called: ${toolName}`,
          JSON.stringify(args, null, 2)
        );

        const rawResult = handler
          ? await handler(args)
          : `Error: Tool "${toolName}" is not permitted at depth ${currentDepth}`;

        const result = typeof rawResult === "string" && rawResult.trim()
          ? rawResult.trim()
          : "Error: Tool executed but returned an empty or invalid result.";

        console.log(
          `Agent depth ${currentDepth} executed ${toolName}`
        );

        // Send tool result back to model 
        return {
          role: "tool",
          tool_call_id: call.id,
          content: result,
        };
      })
    ); 

    // this marks the end of the promise all arch as this will have all the tool requests in itself 
    // concurrently right ? 
    

    // Push all tool results into conversation
    agentMessages.push(...toolResults);

    console.log(
      "\nTool execution completed. Starting next cycle..."
    );
  }
}

