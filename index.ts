import * as p from "@clack/prompts";
import { runMainAgent, clearSession } from "./src/orchestrator";

async function main() {
  console.clear();

  // this introduces the forge cli to the user in a clean box
  p.intro("FORGE Autonomous Multi-Agent Runtime -- ");

  while (true) {
    // prompt user for input with built-in validation
    const userInput = await p.text({
      message: "What task should FORGE execute?",
      placeholder: "e.g. Check weather in Pune and Tokyo, or type /clear or exit",
      validate: (value) => {
        if (!value || !value.trim()) return "Please enter a valid task!";
      },
    });

    // handle ctrl+c or cancel commands  are handeled here
    if (p.isCancel(userInput)) {
      p.outro("Session cancelled. Exiting FORGE...");
      break;
    }

    const trimmed = userInput.trim();

    // handle exit commands
    if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit") {
      p.outro("Exiting FORGE. Goodbye!");
      break;
    }

    // handle blackboard reset
    if (trimmed === "/clear") {
      clearSession();
      p.log.success("Blackboard memory cleared!");
      continue;
    }

   console.log("\n-------------------------------------------------------");
   console.log(" Coordinating agents & executing tasks...");
   console.log("-------------------------------------------------------\n");

    const startTime = Date.now();

    try {
      console.log(" FORGE >\n");
      await runMainAgent(trimmed);
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log("\n-------------------------------------------------------");
      p.log.success(`Completed in ${elapsed}s`);
    } catch (err: any) {
      p.log.error(err.message || String(err));
    }
  }
}

main().catch((err: any) => {
  p.log.error(`Agent fatal error: ${err.message}`);
});
