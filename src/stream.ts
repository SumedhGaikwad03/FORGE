

export async function readStreamingResponse(res: Response) {
  if (!res.body) {
    throw new Error("Response body is missing");
  }

  // allows to consuume the incoming data 
  const reader = res.body.getReader();

  // this will be used to convert the bytes to redable streams right 
  const decoder = new TextDecoder();

  let buffer = "";
  let content = "";
  // this map is used to store all the tool calls made by the agent here 
  // we need this as we pass the toolcall back to the main machine 

  const toolCalls = new Map<number, any>();

  // stores the reason why the ai stopped responing here 
  let finishReason: string | null = null;


  // this 
  function processLine(line: string) {

    // this is complete line of data that is to be processed int he system 
    const trimmed = line.trim();

    // we only care for the data varibale here 
    if (!trimmed.startsWith("data:")) return;

    // we trim the "data" part is of 5 words 
    const rawData = trimmed.slice(5).trim();


    if (!rawData || rawData === "[DONE]") return;

    let data: any;

    try {
      // convert the raw data into object here 
      data = JSON.parse(rawData);
    } catch {
      console.error("\nInvalid SSE JSON:", rawData);
      return;
    }

    if (data.error) {
      throw new Error(
        data.error.message || "Streaming API error"
      );
    }

    const choice = data.choices?.[0];

    if (!choice) return;

    // delta is just the new piece of info chanined to the event here 
    // this has the actual info of the project here 
    const delta = choice.delta;

    // Reasoning tokens , for some models not all but some 
    if (delta?.reasoning) {
      // in the received delta if there exists an reasoning then we stdout the delta here 

      process.stdout.write(delta.reasoning);
    }

    // Normal response tokens
    if (delta?.content) {
 
      content += delta.content;

      // here each conseactive check is build up in the terminal 
      process.stdout.write(delta.content);
    }

    // Reconstruct streamed tool calls
    if (delta?.tool_calls) {
      for (const toolDelta of delta.tool_calls) {
        const index = toolDelta.index ?? 0;

        // we basically upsert an index here if not there 

        if (!toolCalls.has(index)) {
          toolCalls.set(index, {
            id: toolDelta.id || "",
            type: "function",
            function: {
              name: "",
              arguments: "",
            },
          });
        }

        const existing = toolCalls.get(index);

        if (toolDelta.id) {
          existing.id = toolDelta.id;
        }

        // genrate the function name 
        if (toolDelta.function?.name) {
          existing.function.name +=
            toolDelta.function.name;
        }
 
        // here we genrate the arugmets here 
        if (toolDelta.function?.arguments) {
          existing.function.arguments +=
            toolDelta.function.arguments;
        }
      }
    }
 // catch the finish reason for this  
    if (choice.finish_reason) {
      finishReason = choice.finish_reason;
    }
  }

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;
 // here we add the current stream to the buffer that is needed to move ahead 
    buffer += decoder.decode(value, {
      stream: true,
    });

    // handles the split of the chars in both ways as /r or /n 
    const lines = buffer.split(/\r?\n/);

    // removes the last elemet from the array then saves it 
    // an remaining part is still saved in the buffer 
    buffer = lines.pop() ?? "";


    for (const line of lines) {
      processLine(line);
    }
  }
 
  // process what is left in the decoder 
  buffer += decoder.decode();

  // process the line in buffer now 
  if (buffer.trim()) {
    processLine(buffer);
  }

  return {
    role: "assistant",
    content: content || null,
    tool_calls: Array.from(toolCalls.values()),
    finish_reason: finishReason,
  };
}
