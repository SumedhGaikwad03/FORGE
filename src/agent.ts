import { readStreamingResponse } from "./stream";
import { createToolHandlers, tools } from "./tools";

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

export async function executeAgent(task : string ,
  currentDepth : number , 
  delegateTask : (task :string) => Promise<string>,
  canDelegate : boolean
) {

  // this is an system promt for thr agent itself here 


  const systemPrompt = currentDepth === 0
    ? `You are the Master Coordinator Agent.
Your role:
1. Break down the user's objective into separate sub-tasks.
2. Delegate each sub-task to an independent sub-agent using \`run_sub_agent\`.
3. Do NOT execute operational tools directly—always delegate.
4. Wait for all sub-agents to finish, synthesize their findings, and present a structured final response.`
    : `You are an operational sub-agent tasked with executing a specific assigned task.
Your role:
1. Use your available tools (run_bash, get_weather, search_web) to complete the assignment.
2. Verify tool outputs before concluding.
3. Return a direct, factual summary of your results to your parent agent.`;

  const agentMessages: any[] = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: task
    }
  ];


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

    console.log("\n\nSending request to Ollama\n");

    const res = await fetch(
      "http://localhost:11434/v1/chat/completions",
      {
        method: "POST",

        headers: {
          Authorization: "Bearer ollama",
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          model: "qwen2.5:14b",
          messages : agentMessages,
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


    // if no tools are vaild then stop the cond 
    if (
      !assistantMessage.tool_calls ||
      assistantMessage.tool_calls.length === 0
    ) {
      return assistantMessage.content || "Task is done ";
    }
   // console.log("The agent has finished the first loop for iteration ")
    
    for (const call of assistantMessage.tool_calls) {

      const toolName = call.function.name;

      let args: any;

      try {
        args = JSON.parse(call.function.arguments);
      } catch {
        console.error(
          "Invalid tool arguments:",
          call.function.arguments
        );

        agentMessages.push({
          role: "tool",
          tool_call_id: call.id,
          content: "Error: Invalid JSON arguments",
        });

        continue;
      }

      const isPermitted = availableTools.some(t => t.function.name === toolName);



      const handler = isPermitted ? toolHandlers[toolName] : null ;

      console.log(
        `\nTool called: ${toolName}`,
        JSON.stringify(args, null, 2)
      );

      const result = handler
        ? await handler(args)
        : `Error: Tool "${toolName}" is not permitted at depth ${currentDepth}`;

      
        console.log(
        `Agent depth ${currentDepth} executed ${toolName}`
      );

      // Send tool result back to model 
      // this is the part we push the current result into the messages and then the loop goes on as it is 
      agentMessages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result,
      });
    }

    console.log(
      "\nTool execution completed. Starting next cycle..."
    );
  }
}

