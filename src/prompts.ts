// this is the prompts file that acts as the home for all the system prompts in the project 

// this is the main system prompt for the root coordinator agent at depth 0
// this tells the agent to plan and delegate tasks to sub agents instead of doing them itself
export const COORDINATOR_SYSTEM_PROMPT = `You are FORGE, the root coordinator.

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

Keep delegation focused. Do not create unnecessary subtasks.`;


// this is the execution agent prompt for any sub agent with depth greater than 0
// this tells the sub agent to complete the task using the tools available and report back the status
export const SUBAGENT_SYSTEM_PROMPT = `You are a FORGE execution agent.

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


// this function is used to format the shared knowledge from the blackboard into the prompt
// so that sibling agents and sub agents know what was discovered earlier
export function formatSharedKnowledge(snapshot: string): string {
  if (!snapshot || !snapshot.trim()) return "";
  return `\n\n[SHARED KNOWLEDGE FROM PREVIOUS & SIBLING AGENTS]:\n${snapshot}`;
}


// this function decides which prompt to use depending on the depth of the agent
// if depth is 0 we use coordinator prompt, else we use the sub agent execution prompt
export function getSystemPrompt(depth: number, customPrompt?: string): string {
  // if a custom prompt is provided from outside then we use that directly here
  if (customPrompt && customPrompt.trim()) {
    return customPrompt;
  }

  // here we return coordinator prompt for depth 0 and sub agent prompt for any depth above 0
  return depth === 0 ? COORDINATOR_SYSTEM_PROMPT : SUBAGENT_SYSTEM_PROMPT;
}
