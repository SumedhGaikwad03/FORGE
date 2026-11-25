import { runAgent , runSubAgent} from "./src/agent";
export { API_KEY } from "./src/config";
export { readStreamingResponse } from "./src/stream";
export { toolHandlers, tools } from "./src/tools";
export { runAgent, messages , runSubAgent } from "./src/agent";


// time to start our agent here 
try {
  const finalAnswer = await runAgent();

  console.log("\n\nFinal Answer:\n");

  console.log(finalAnswer);

} catch (err: any) {
  console.error("\nAgent failed:", err.message);
}
