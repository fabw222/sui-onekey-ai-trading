import { A2AClient } from "./a2a_client"; // Import necessary types
import { v4 as uuidv4 } from "uuid"; // Example for generating task IDs
import { Task, TaskQueryParams, TaskSendParams } from "./schema";
const client = new A2AClient("http://localhost:41241", fetch); // Replace with your server URL

export async function sui_tx_agent(prompt: string) {
  try {
    // Send a simple task (pass only params)
    const taskId = uuidv4();
    const sendParams: TaskSendParams = {
      id: taskId,
      message: { role: "user", parts: [{ text: prompt, type: "text" }] },
    };
    // Method now returns Task | null directly
    const taskResult: Task | null = await client.sendTask(sendParams);
    console.log("Send Task Result:", taskResult);

    // Get task status (pass only params)
    const getParams: TaskQueryParams = { id: taskId };
    // Method now returns Task | null directly
    const getTaskResult: Task | null = await client.getTask(getParams);
    console.log("Get Task Result:", getTaskResult);
    return getTaskResult;
  } catch (error) {
    console.error("A2A Client Error:", error);
  }
}
