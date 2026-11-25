import { readStreamingResponse } from "./stream";
import { toolHandlers, tools } from "./tools";

const path: string = String.raw`C:\Users\777su\Desktop\claudeMini\hello.txt`;


export const messages: any[] = [
  {
    role: "user",
    content:
     // "What is the weather in Delhi and Pune?  " + 
    //  `also make the subagent read the text file in the called hello.txt at ${path} and execute command written  in that file `,
    "what happend with jensen huang recently ? "
  },
];

export const agentMessages: any[] = [
  {
    role: "system",
    content: `
      You are an autonomous sub-agent responsible for completing tasks delegated by a parent agent.

      Your objective is to understand the assigned task, determine the necessary steps, use the available tools, and complete the task reliably.

      Instructions:

      1. Understand the task and identify the expected outcome.
      2. Break complex tasks into smaller steps when necessary.
      3. Use the tools provided in the API request whenever required.
      4. Inspect tool outputs before deciding on the next action.
      5. Continue using tools until the task is completed or a blocker is encountered.
      6. Preserve existing files and data unless explicitly instructed otherwise.
      7. Never execute destructive or potentially unsafe operations without proper authorization.
      8. Handle errors gracefully and avoid unnecessary tool calls.
      9. Verify the results of important operations before declaring completion.
      10. Never claim an action succeeded if it was not successfully executed.

      Communication:

      - Keep execution focused on the assigned task.
      - Provide a concise summary of completed actions.
      - Clearly report errors or incomplete tasks.
      - Return the final result to the parent agent.

      Work independently and prioritize accuracy, safety, and successful task completion.
    `
  }
];

export async function runAgent() {

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
          model: "qwen3:8b",
          messages,
          tools,
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
    const assistantMessage =
      await readStreamingResponse(res);

      // this is the tool call by the internal redis string 
    console.log(
      "\n\nTool calls in this response:",
      assistantMessage.tool_calls.length
    );

    // Push assistant response into conversation
    messages.push(assistantMessage);

    // STOPPING CONDITION
    if (
      !assistantMessage.tool_calls ||
      assistantMessage.tool_calls.length === 0
    ) {
      return assistantMessage.content;
    }
    
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

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: "Error: Invalid JSON arguments",
        });

        continue;
      }

      const handler = toolHandlers[toolName];

      console.log(
        `\nTool called: ${toolName}`,
        JSON.stringify(args, null, 2)
      );

      const result = handler
        ? await handler(args)
        : `Error: Unknown tool "${toolName}"`;

      console.log("\nTool result:", result);

      // Send tool result back to model 
      // this is the part we push the current result into the messages and then the loop goes on as it is 
      messages.push({
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


export async function runSubAgent(task: string) {

  agentMessages.push({
    role: "user",
    content: task
  });

  while (true) {

    console.log("Sending req via the sub agent to the ollama server");

    const res = await fetch(
      "http://localhost:11434/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer ollama",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen3:8b",
          messages: agentMessages,
          tools,
          tool_choice: "auto",
          stream: true,
        }),
      }
    );

    if (!res.ok) {
      throw new Error(
        `Sub-agent API error ${res.status}: ${await res.text()}`
      );
    }

    const assistantMessage =
      await readStreamingResponse(res);

    // Save the assistant response
    agentMessages.push(assistantMessage);

    // Stop when there are no more tool calls
    if (
      !assistantMessage.tool_calls ||
      assistantMessage.tool_calls.length === 0
    ) {
      return assistantMessage.content || "Sub-agent completed.";
    }

    // Execute requested tools
    for (const call of assistantMessage.tool_calls) {

      const toolName = call.function.name;

      let args: any;

      try {
        args = JSON.parse(call.function.arguments);
      } catch {
        agentMessages.push({
          role: "tool",
          tool_call_id: call.id,
          content: "Error: Invalid JSON arguments",
        });

        continue;
      }

      const handler = toolHandlers[toolName];

      const result = handler
        ? await handler(args)
        : `Unknown tool: ${toolName}`;

      console.log(`Sub-agent executed: ${toolName}`);
      console.log("Result:", result);

      agentMessages.push({
        role: "tool",
        tool_call_id: call.id,
        content: String(result),
      });
    }
  }
}