import * as p from "@clack/prompts";
import { runMainAgent, clearSession } from "./src/orchestrator";

async function main() {
  console.clear();

  // this introduces the forge cli to the user in a clean box
  p.intro("🤖 FORGE Autonomous Multi-Agent Runtime");

  while (true) {
    // prompt user for input with built-in validation
    const userInput = await p.text({
      message: "What task should FORGE execute?",
      placeholder: "e.g. Check weather in Pune and Tokyo, or type /clear or exit",
      validate: (value) => {
        if (!value || !value.trim()) return "Please enter a valid task!";
      },
    });

    // handle ctrl+c or cancel
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

    // start an animated spinner while agents plan and execute
    const spinner = p.spinner();
    spinner.start("Coordinator planning and delegating tasks to sub-agents...");

    const startTime = Date.now();

    try {
      const result = await runMainAgent(trimmed);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      // stop the spinner and show how long it took
      spinner.stop(`All agents finished in ${elapsed}s`);

      // display the final consolidated result inside a clean styled note card
      p.note(result, "Final Consolidated Report");
    } catch (err: any) {
      spinner.stop("Execution failed!");
      p.log.error(err.message || String(err));
    }
  }
}

main().catch((err: any) => {
  p.log.error(`Agent fatal error: ${err.message}`);
});
