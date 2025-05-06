// Import necessary types from schema.ts
import {
  // Core types
  AgentCard,
  // AgentCapabilities, // 不再使用，已注释掉
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
  A2ARequest,
  // Full Request types (needed for internal generics)
  SendTaskRequest,
  GetTaskRequest,
  CancelTaskRequest,
  SendTaskStreamingRequest,
  TaskResubscriptionRequest,
  SetTaskPushNotificationRequest,
  GetTaskPushNotificationRequest,
  // Specific Params types (used directly in public method signatures)
  TaskSendParams,
  TaskQueryParams, // Used by get, resubscribe
  TaskIdParams, // Used by cancel, getTaskPushNotificationConfig
  TaskPushNotificationConfig, // Used by setTaskPushNotificationConfig
  // Full Response types (needed for internal generics and result extraction)
  SendTaskResponse,
  GetTaskResponse,
  CancelTaskResponse,
  SendTaskStreamingResponse,
  SetTaskPushNotificationResponse,
  GetTaskPushNotificationResponse,
  // Response Payload types (used in public method return signatures)
  Task,
  // TaskHistory, // Not currently implemented
  // Streaming Payload types (used in public method yield signatures)
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
} from "./schema.js";
import axios, { AxiosResponse, AxiosResponseHeaders, RawAxiosResponseHeaders } from "axios";

// Simple error class for client-side representation of JSON-RPC errors
class RpcError extends Error {
  code: number;
  data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = "RpcError";
    this.code = code;
    this.data = data;
  }
}

/**
 * A client implementation for the A2A protocol that communicates
 * with an A2A server over HTTP using JSON-RPC.
 */
export class A2AClient {
  private baseUrl: string;
  private fetchImpl: unknown;
  private cachedAgentCard: AgentCard | null = null;

  /**
   * Creates an instance of A2AClient.
   * @param baseUrl The base URL of the A2A server endpoint.
   * @param fetchImpl Optional custom fetch implementation (e.g., for Node.js environments without global fetch). Defaults to global fetch.
   */
  constructor(baseUrl: string) {
    // Ensure baseUrl doesn't end with a slash for consistency
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    this.fetchImpl = axios;
  }

  /**
   * Helper to generate unique request IDs.
   * Uses crypto.randomUUID if available, otherwise a simple timestamp-based fallback.
   */
  private _generateRequestId(): string | number {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    } else {
      // Fallback for environments without crypto.randomUUID
      return Date.now();
    }
  }

  /**
   * Internal helper method to make JSON-RPC calls via HTTP POST.
   * @param method The JSON-RPC method name.
   * @param params The parameters for the method.
   * @param acceptHeader The desired Accept header ('application/json' or 'text/event-stream').
   * @returns A Promise resolving to the fetch Response object.
   */
  private async _makeHttpRequest<Req extends A2ARequest>(
    method: Req["method"],
    params: Req["params"],
    acceptHeader: "application/json" | "text/event-stream" = "application/json"
  ): Promise<Response> {
    const requestId = this._generateRequestId();
    // JSONRPCRequest is not generic, the specific type comes from Req
    const requestBody: JSONRPCRequest = {
      jsonrpc: "2.0",
      id: requestId,
      method: method,
      params: params,
    };

    try {
      // 使用 axios 发送请求
      const axiosResponse = await axios.post(this.baseUrl, requestBody, {
        headers: {
          "Content-Type": "application/json",
          Accept: acceptHeader,
        },
      });

      // 将 axios 响应转换为标准 Response 对象以保持与现有代码兼容
      const headers = new Headers();
      const axiosHeaders = axiosResponse.headers as RawAxiosResponseHeaders | AxiosResponseHeaders;
      
      // 将 axios 的响应头转换为 Headers 对象
      Object.entries(axiosHeaders).forEach(([key, value]) => {
        if (value !== undefined) {
          headers.append(key, value.toString());
        }
      });

      const response = new Response(JSON.stringify(axiosResponse.data), {
        status: axiosResponse.status,
        statusText: axiosResponse.statusText,
        headers,
      });

      return response;
    } catch (networkError) {
      console.error("Network error during RPC call:", networkError);
      
      // 如果是 axios 错误，尝试提取更详细信息
      let statusCode = -32603; // 默认内部错误代码
      let errorMessage = networkError instanceof Error ? networkError.message : String(networkError);
      
      if (axios.isAxiosError(networkError) && networkError.response) {
        statusCode = networkError.response.status;
        errorMessage = `HTTP ${statusCode}: ${networkError.response.statusText}`;
        
        // 尝试从响应主体提取更具体的错误信息
        if (networkError.response.data) {
          const data = networkError.response.data;
          if (typeof data === 'object' && data !== null && 'error' in data) {
            const errorObj = data.error as { message?: string; code?: number };
            errorMessage = errorObj.message || errorMessage;
            statusCode = errorObj.code || statusCode;
          }
        }
      }

      // 包装网络错误为标准格式
      throw new RpcError(
        statusCode,
        `Network error: ${errorMessage}`,
        networkError // 包含原始错误
      );
    }
  }

  /**
   * Handles standard JSON-RPC responses (non-streaming).
   * Parses the response, checks for JSON-RPC errors, and returns ONLY the 'result' payload.
   */
  private async _handleJsonResponse<Res extends JSONRPCResponse>( // Takes full Response type
    response: Response,
    expectedMethod?: string // Optional: helps in debugging
  ): Promise<Res["result"]> {
    // Return type is now the 'result' property of Res
    let responseBody: string | null = null;
    try {
      if (!response.ok) {
        // Attempt to read body even for non-ok responses for potential JSON errors
        responseBody = await response.text();
        let errorData: JSONRPCError | null = null;
        try {
          // Try parsing as JSON RPC Error response
          const parsedError = JSON.parse(responseBody) as JSONRPCResponse;
          if (parsedError.error) {
            errorData = parsedError.error;
            throw new RpcError(
              errorData.code,
              errorData.message,
              errorData.data
            );
          }
        } catch (parseError) {
          // Ignore parsing error, fall through to generic HTTP error
        }
        // If not a JSON RPC error, throw generic HTTP error
        throw new Error(
          `HTTP error ${response.status}: ${response.statusText}${
            responseBody ? ` - ${responseBody}` : ""
          }`
        );
      }

      // Read and parse the successful JSON response
      responseBody = await response.text();
      // Parse as the specific JSONRPCResponse type Res
      const jsonResponse = JSON.parse(responseBody) as Res;

      // Basic validation of the JSON-RPC response structure
      if (
        typeof jsonResponse !== "object" ||
        jsonResponse === null ||
        jsonResponse.jsonrpc !== "2.0"
      ) {
        throw new RpcError(
          -32603,
          "Invalid JSON-RPC response structure received from server."
        );
      }

      // Check for application-level errors within the JSON-RPC response
      if (jsonResponse.error) {
        throw new RpcError(
          jsonResponse.error.code,
          jsonResponse.error.message,
          jsonResponse.error.data
        );
      }

      // Optional: Validate response ID matches request ID if needed (requires passing request ID down)

      // Extract and return only the result payload
      return jsonResponse.result || null; // 确保返回值至少是 null 而非 undefined
    } catch (error) {
      console.error(
        `Error processing RPC response for method ${
          expectedMethod || "unknown"
        }:`,
        error,
        responseBody ? `\nResponse Body: ${responseBody}` : ""
      );
      // Re-throw RpcError instances directly, wrap others
      if (error instanceof RpcError) {
        throw error;
      } else {
        throw new RpcError(
          -32603, // Use literal value for ErrorCodeInternalError
          `Failed to process response: ${
            error instanceof Error ? error.message : String(error)
          }`,
          error
        );
      }
    }
  }

  /**
   * Handles streaming Server-Sent Events (SSE) responses.
   * Returns an AsyncIterable that yields ONLY the 'result' payloads (events).
   * Throws RpcError if an error is received in the stream.
   */
  private async *_handleStreamingResponse<StreamRes extends JSONRPCResponse>( // Takes full Response type
    response: Response,
    expectedMethod?: string // Optional: helps in debugging
  ): AsyncIterable<StreamRes["result"]> {
    // Yield type is now the 'result' property of StreamRes
    if (!response.ok || !response.body) {
      let errorText: string | null = null;
      try {
        errorText = await response.text();
      } catch (_) {
        /* Ignore read error */
      }
      console.error(
        `HTTP error ${response.status} received for streaming method ${
          expectedMethod || "unknown"
        }.`,
        errorText ? `Response: ${errorText}` : ""
      );
      throw new Error(
        `HTTP error ${response.status}: ${response.statusText} - Failed to establish stream.`
      );
    }

    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Process any remaining data in the buffer before exiting
          if (buffer.trim()) {
            console.warn(
              `SSE stream ended with partial data in buffer for method ${expectedMethod}: ${buffer}`
            );
          }
          break;
        }

        buffer += value;
        const lines = buffer.replace(/\r/g, "").split("\n\n"); // SSE messages end with \n\n
        buffer = lines.pop() || ""; // Keep potential partial message
        for (const message of lines) {
          if (message.startsWith("data: ")) {
            const dataLine = message.substring("data: ".length).trim();
            if (dataLine) {
              // Ensure data is not empty
              try {
                // Parse as the specific JSONRPCResponse type StreamRes
                const parsedData = JSON.parse(dataLine) as StreamRes;
                // Basic validation of streamed data structure
                if (
                  typeof parsedData !== "object" ||
                  parsedData === null ||
                  !("jsonrpc" in parsedData && parsedData.jsonrpc === "2.0")
                ) {
                  console.error(
                    `Invalid SSE data structure received for method ${expectedMethod}:`,
                    dataLine
                  );
                  continue; // Skip invalid data
                }

                // Check for errors within the streamed message
                if (parsedData.error) {
                  console.error(
                    `Error received in SSE stream for method ${expectedMethod}:`,
                    parsedData.error
                  );
                  // Depending on requirements, you might want to:
                  // 1. Yield an error object
                  // 2. Throw an error (terminating the stream)
                  // 3. Just log and continue (current behavior)
                  // Throw an error to terminate the stream
                  throw new RpcError(
                    parsedData.error.code,
                    parsedData.error.message,
                    parsedData.error.data
                  );
                } else if (parsedData.result !== undefined) {
                  // Yield ONLY the result payload, with an explicit cast if needed
                  const result = parsedData.result as StreamRes["result"];
                  if (result !== null && result !== undefined) {
                    yield result;
                  }
                } else {
                  // Should not happen if error and result are mutually exclusive per spec
                  console.warn(
                    `SSE data for ${expectedMethod} has neither result nor error:`,
                    parsedData
                  );
                }
              } catch (e) {
                console.error(
                  `Failed to parse SSE data line for method ${expectedMethod}:`,
                  dataLine,
                  e
                );
              }
            }
          } else if (message.trim()) {
            // Handle other SSE lines if necessary (e.g., 'event:', 'id:', 'retry:')
            // console.debug(`Received non-data SSE line: ${message}`);
          }
        }
      }
    } catch (error) {
      console.error(
        `Error reading SSE stream for method ${expectedMethod}:`,
        error
      );
      throw error; // Re-throw the stream reading error
    } finally {
      reader.releaseLock(); // Ensure the reader lock is released
      console.log(`SSE stream finished for method ${expectedMethod}.`);
    }
  }

  /**
   * Retrieves the AgentCard.
   * Note: The standard A2A protocol doesn't define a JSON-RPC method for this.
   * This implementation fetches it from a hypothetical '/agent-card' endpoint
   * on the same server, assuming it's provided out-of-band.
   * Caches the result after the first successful fetch.
   */
  // @ts-expect-error - Protocol defines sync, but client needs async fetch.
  async agentCard(): Promise<AgentCard> {
    if (this.cachedAgentCard) {
      return this.cachedAgentCard;
    }

    // Assumption: Server exposes the card at a simple GET endpoint.
    // Adjust this URL/method if the server provides the card differently.
    const cardUrl = `${this.baseUrl}/agent-card`; // Or just this.baseUrl if served at root

    try {
      // 使用 axios 获取 agent card
      const response = await axios.get(cardUrl, {
        headers: {
          Accept: "application/json",
        },
      });

      // axios 会自动处理非 2xx 响应状态码
      const card = response.data;
      // TODO: Add validation using a Zod schema or similar if available
      this.cachedAgentCard = card as AgentCard;
      return this.cachedAgentCard;
    } catch (error) {
      console.error("Failed to fetch or parse agent card:", error);
      
      // 处理 axios 错误
      let errorMessage = error instanceof Error ? error.message : String(error);
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = `HTTP error ${error.response.status} fetching agent card from ${cardUrl}: ${error.response.statusText}`;
      }
      
      throw new RpcError(
        -32603, // 使用内部错误代码
        `Could not retrieve agent card: ${errorMessage}`,
        error
      );
    }
  }

  /**
   * Sends a task request to the agent (non-streaming).
   * @param params The parameters for the tasks/send method.
   * @returns A promise resolving to the Task object or null.
   */
  async sendTask(params: TaskSendParams): Promise<Task | null> {
    const httpResponse = await this._makeHttpRequest<SendTaskRequest>(
      "tasks/send",
      params
    );
    // Pass the full Response type to handler, which returns Res['result']
    const result = await this._handleJsonResponse<SendTaskResponse>(
      httpResponse,
      "tasks/send"
    );
    return result as Task | null;
  }

  /**
   * Sends a task request and subscribes to streaming updates.
   * @param params The parameters for the tasks/sendSubscribe method.
   * @yields TaskStatusUpdateEvent or TaskArtifactUpdateEvent payloads.
   */
  sendTaskSubscribe(
    params: TaskSendParams
  ): AsyncIterable<TaskStatusUpdateEvent | TaskArtifactUpdateEvent> {
    const streamGenerator = async function* (
      this: A2AClient
    ): AsyncIterable<TaskStatusUpdateEvent | TaskArtifactUpdateEvent> {
      const httpResponse =
        await this._makeHttpRequest<SendTaskStreamingRequest>(
          "tasks/sendSubscribe",
          params,
          "text/event-stream"
        );
      // Pass the full Response type to handler, which yields Res['result']
      yield* this._handleStreamingResponse<SendTaskStreamingResponse>(
        httpResponse,
        "tasks/sendSubscribe"
      );
    }.bind(this)();

    return streamGenerator; // Type is AsyncIterable<TaskStatusUpdateEvent | TaskArtifactUpdateEvent>
  }

  /**
   * Retrieves the current state of a task.
   * @param params The parameters for the tasks/get method.
   * @returns A promise resolving to the Task object or null.
   */
  async getTask(params: TaskQueryParams): Promise<Task | null> {
    const httpResponse = await this._makeHttpRequest<GetTaskRequest>(
      "tasks/get",
      params
    );
    const result = await this._handleJsonResponse<GetTaskResponse>(httpResponse, "tasks/get");
    return result as Task | null;
  }

  /**
   * Cancels a currently running task.
   * @param params The parameters for the tasks/cancel method.
   * @returns A promise resolving to the updated Task object (usually canceled state) or null.
   */
  async cancelTask(params: TaskIdParams): Promise<Task | null> {
    const httpResponse = await this._makeHttpRequest<CancelTaskRequest>(
      "tasks/cancel",
      params
    );
    const result = await this._handleJsonResponse<CancelTaskResponse>(
      httpResponse,
      "tasks/cancel"
    );
    return result as Task | null;
  }

  /**
   * Sets or updates the push notification config for a task.
   * @param params The parameters for the tasks/pushNotification/set method (which is TaskPushNotificationConfig).
   * @returns A promise resolving to the confirmed TaskPushNotificationConfig or null.
   */
  async setTaskPushNotification(
    params: TaskPushNotificationConfig
  ): Promise<TaskPushNotificationConfig | null> {
    const httpResponse = await this._makeHttpRequest<SetTaskPushNotificationRequest>(
      "tasks/pushNotification/set",
      params
    );
    const result = await this._handleJsonResponse<SetTaskPushNotificationResponse>(
      httpResponse,
      "tasks/pushNotification/set"
    );
    return result as TaskPushNotificationConfig | null;
  }

  /**
   * Retrieves the currently configured push notification config for a task.
   * @param params The parameters for the tasks/pushNotification/get method.
   * @returns A promise resolving to the TaskPushNotificationConfig or null.
   */
  async getTaskPushNotification(
    params: TaskIdParams
  ): Promise<TaskPushNotificationConfig | null> {
    const httpResponse = await this._makeHttpRequest<GetTaskPushNotificationRequest>(
      "tasks/pushNotification/get",
      params
    );
    const result = await this._handleJsonResponse<GetTaskPushNotificationResponse>(
      httpResponse,
      "tasks/pushNotification/get"
    );
    return result as TaskPushNotificationConfig | null;
  }

  /**
   * Resubscribes to updates for a task after a potential connection interruption.
   * @param params The parameters for the tasks/resubscribe method.
   * @yields TaskStatusUpdateEvent or TaskArtifactUpdateEvent payloads.
   */
  resubscribeTask(
    params: TaskQueryParams
  ): AsyncIterable<TaskStatusUpdateEvent | TaskArtifactUpdateEvent> {
    const streamGenerator = async function* (
      this: A2AClient
    ): AsyncIterable<TaskStatusUpdateEvent | TaskArtifactUpdateEvent> {
      const httpResponse =
        await this._makeHttpRequest<TaskResubscriptionRequest>(
          "tasks/resubscribe",
          params,
          "text/event-stream"
        );
      yield* this._handleStreamingResponse<SendTaskStreamingResponse>(
        httpResponse,
        "tasks/resubscribe"
      );
    }.bind(this)();

    return streamGenerator; // Type is AsyncIterable<TaskStatusUpdateEvent | TaskArtifactUpdateEvent>
  }

  /**
   * Optional: Checks if the server likely supports optional methods based on agent card.
   * This is a client-side heuristic and might not be perfectly accurate.
   * @param capability The capability to check (e.g., 'streaming', 'pushNotifications').
   * @returns A promise resolving to true if the capability is likely supported.
   */
  async supports(capability: "streaming" | "pushNotifications"): Promise<boolean> {
    try {
      const card = await this.agentCard(); // Fetch card if not cached
      switch (capability) {
        // Check boolean flags directly on the capabilities object
        case "streaming":
          return !!card.capabilities?.streaming; // Use optional chaining and boolean conversion
        case "pushNotifications":
          return !!card.capabilities?.pushNotifications; // Use optional chaining and boolean conversion
        default:
          return false;
      }
    } catch (error) {
      console.error(
        `Failed to determine support for capability '${capability}':`,
        error
      );
      return false; // Assume not supported if card fetch fails
    }
  }
}
