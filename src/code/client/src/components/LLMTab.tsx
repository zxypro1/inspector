import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabsContent } from "@/components/ui/tabs";
import { CompatibilityCallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "highlight.js/styles/github-dark.css";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ModelConfig {
  value: string;
  label: string;
  provider: "openai" | "qianwen";
  apiUrl: string;
  supportsTool: boolean;
}

interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string | Record<string, unknown>;
  };
}

interface ApiToolCall {
  type: string;
  function?: {
    name: string;
    arguments: string | Record<string, unknown>;
  };
}

// 获取代理服务器URL
// const params = new URLSearchParams(window.location.search);
// const PROXY_PORT = params.get("proxyPort") ?? "3000";
console.log(import.meta.env);
const PROXY_SERVER_URL = `${import.meta.env.VITE_SERVER_URL}`;

const LLMTab = ({
  tools = [],
  callTool,
  connectionStatus,
}: {
  tools: Tool[];
  callTool: (name: string, params: Record<string, unknown>) => Promise<CompatibilityCallToolResult | null>;
  connectionStatus: "connected" | "connecting" | "disconnected" | "error";
}) => {
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevHeightRef = useRef<number | null>(null);
  const isInitialMount = useRef(true);

  // 使用useLayoutEffect确保在DOM更新前捕获并设置高度
  useLayoutEffect(() => {
    const historyPaneElement = document.querySelector(
      ".relative.border-t.border-border",
    ) as HTMLElement;
    if (!historyPaneElement) return;

    if (isInitialMount.current) {
      // 首次挂载时保存当前高度
      const heightStyle = historyPaneElement.style.height;
      const currentHeight = heightStyle
        ? parseInt(heightStyle.replace("px", ""))
        : 300;
      prevHeightRef.current = currentHeight;
      isInitialMount.current = false;
    }

    // 最小化历史面板
    historyPaneElement.style.height = "30px";

    // 在组件卸载时恢复历史面板高度
    return () => {
      if (prevHeightRef.current && prevHeightRef.current > 30) {
        historyPaneElement.style.height = `${prevHeightRef.current}px`;
      } else {
        historyPaneElement.style.height = "300px"; // 默认高度
      }
    };
  }, []);

  // 代理请求函数
  const proxyFetch = async (apiUrl: string, options: RequestInit) => {
    try {
      // 通过代理服务器转发请求
      const response = await fetch(`${PROXY_SERVER_URL}/api-proxy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: apiUrl,
          method: options.method || "POST",
          headers: options.headers,
          body: options.body ? JSON.parse(options.body as string) : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "代理请求失败");
      }

      return response;
    } catch (error) {
      console.error("代理请求错误:", error);
      throw error;
    }
  };

  const models: ModelConfig[] = [
    {
      value: "gpt-4",
      label: "GPT-4",
      provider: "openai",
      apiUrl: "https://api.openai.com/v1/chat/completions",
      supportsTool: true,
    },
    {
      value: "gpt-4-turbo",
      label: "GPT-4 Turbo",
      provider: "openai",
      apiUrl: "https://api.openai.com/v1/chat/completions",
      supportsTool: true,
    },
    {
      value: "claude-3-opus-20240229",
      label: "Claude 3 Opus",
      provider: "openai",
      apiUrl: "https://api.openai.com/v1/chat/completions",
      supportsTool: true,
    },
    {
      value: "claude-3-sonnet-20240229",
      label: "Claude 3 Sonnet",
      provider: "openai",
      apiUrl: "https://api.openai.com/v1/chat/completions",
      supportsTool: true,
    },
    {
      value: "qwen-max",
      label: "通义千问-Max",
      provider: "qianwen",
      apiUrl:
        "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
      supportsTool: true,
    },
    {
      value: "qwen-turbo",
      label: "通义千问-Turbo",
      provider: "qianwen",
      apiUrl:
        "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
      supportsTool: true,
    },
    {
      value: "qwen-plus",
      label: "通义千问-Plus",
      provider: "qianwen",
      apiUrl:
        "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
      supportsTool: true,
    },
  ];

  const getCurrentModelConfig = () => {
    return models.find((model) => model.value === selectedModel) || models[0];
  };

  const formatToolsForModel = (tools: Tool[], provider: string) => {
    if (provider === "openai") {
      return tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }));
    } else if (provider === "qianwen") {
      return tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }));
    }
    return [];
  };

  const formatMessagesForQianwen = (messages: Message[]) => {
    return messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));
  };

  const handleClearHistory = () => {
    setMessages([]);
    setError(null); // 同时清空错误提示
  };

  const handleToolCall = async (toolCalls: ToolCall[]) => {
    const toolResults = [];

    for (const toolCall of toolCalls) {
      if (toolCall.type === "function") {
        const functionCall = toolCall.function;
        const toolName = functionCall.name;
        try {
          const toolParams = JSON.parse(functionCall.arguments as string);
          const res = await callTool(toolName, toolParams);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: toolName,
            content: JSON.stringify(res),
          });
        } catch {
          toolResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: toolName,
            content: JSON.stringify({ error: "工具调用失败" }),
          });
        }
      }
    }

    return toolResults;
  };

  const handleProxyFetch = async (apiUrl: string, messages: Message[], provider: string) => {
    const res = await proxyFetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body:
        provider === "openai"
        ? JSON.stringify({
            model: selectedModel,
            messages: messages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            tools: formatToolsForModel(tools, provider),
            tool_choice: "auto",
          })
        : JSON.stringify({
            model: selectedModel,
            input: {
              messages: formatMessagesForQianwen(messages),
            },
            parameters: {
              result_format: "message",
              tools: formatToolsForModel(tools, provider),
              tool_choice: "auto",
            },
          }),
    });
    if (!res.ok) {
      throw new Error("请求失败");
    }
    const data = await res.json();
    const assistantResponse =
        provider === "openai"
          ? data.choices[0].message
          : data.output?.choices?.[0]?.message || data.output?.choice;

    if (!assistantResponse) {
      throw new Error("无法获取有效的助手响应");
    }
    return assistantResponse;
  }

  const handleQianwenToolCalls = async (toolCalls: ApiToolCall[]) => {
    const toolResults = [];

    for (const toolCall of toolCalls) {
      if (toolCall.type === "function" && toolCall.function) {
        const functionCall = toolCall.function;
        const toolName = functionCall.name;
        try {
          const toolParams =
            typeof functionCall.arguments === "string"
              ? JSON.parse(functionCall.arguments)
              : functionCall.arguments;

          const res = await callTool(toolName, toolParams);
          console.log(JSON.stringify(res))
          toolResults.push({
            role: "tool",
            name: toolName,
            content: JSON.stringify(res),
          });
        } catch (err) {
          console.error("工具调用错误:", err);
          toolResults.push({
            role: "tool",
            name: toolName,
            content: JSON.stringify({ error: "工具调用失败" }),
          });
        }
      }
    }

    return toolResults;
  };

  const handleSend = async () => {
    if (!inputMessage.trim() || !apiKey) return;
    setError(null);

    const newMessage: Message = {
      role: "user",
      content: inputMessage,
    };

    // 初始化消息历史
    let currentMessages = [...messages, newMessage];
    setMessages(currentMessages);
    setInputMessage("");
    setIsLoading(true);

    try {
      const modelConfig = getCurrentModelConfig();
      let hasToolCall = true;
      let iterationCount = 0;
      const MAX_ITERATIONS = 20; // 安全阀防止无限循环

      while (hasToolCall && iterationCount < MAX_ITERATIONS) {
        iterationCount++;
        hasToolCall = false;

        let assistantMessage: Message;
        const assistantResponse = await handleProxyFetch(modelConfig.apiUrl, currentMessages, modelConfig.provider)

        // 处理工具调用
        const toolCalls = assistantResponse.tool_calls || [];
        if (toolCalls.length > 0) {
          hasToolCall = true;

          // 添加助手消息
          assistantMessage = {
            role: "assistant",
            content: assistantResponse.content || "正在执行工具调用...",
          };
          currentMessages = [...currentMessages, assistantMessage];
          setMessages(currentMessages); // 实时更新UI

          // 执行工具调用
          const toolResults =
            modelConfig.provider === "openai"
              ? await handleToolCall(toolCalls)
              : await handleQianwenToolCalls(toolCalls);

          // 添加工具结果到消息历史
          // @ts-ignore
          currentMessages = [...currentMessages, ...toolResults];
          setMessages(currentMessages);
        } else {
          // 最终响应
          assistantMessage = {
            role: "assistant",
            content: assistantResponse.content,
          };
          currentMessages = [...currentMessages, assistantMessage];
          setMessages(currentMessages);
        }
      }
      const newMessage: Message = {
        role: "user",
        content: '总结所有的信息，给我一个最终的结果。不要调用工具',
      };
      currentMessages = [...currentMessages, newMessage];
      const assistantResponse = await handleProxyFetch(modelConfig.apiUrl, currentMessages, modelConfig.provider);
      const assistantMessage: Message = {
        role: "assistant",
        content: assistantResponse.content,
      };
      currentMessages = [...currentMessages, assistantMessage];

      // 最终更新消息状态
      setMessages(currentMessages);
    } catch (error) {
      console.error("Error:", error);
      setError(error instanceof Error ? error.message : "发生未知错误");
    } finally {
      setIsLoading(false);
    }
  };

  // 检查MCP连接状态
  useEffect(() => {
    if (connectionStatus !== "connected") {
      setError(
        connectionStatus === "error"
          ? "MCP服务器连接错误"
          : "请先在Tools标签页连接MCP服务器",
      );
    } else {
      setError(null);
    }
  }, [connectionStatus]);

  return (
    <TabsContent value="llm">
      <div className="flex flex-col h-full p-2 gap-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue placeholder="选择模型" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Input
              type="password"
              placeholder="输入API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            错误: {error}
          </div>
        )}

        <Card className="flex-1 p-2">
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="flex flex-col gap-2">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg prose max-w-none ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground ml-12"
                      : "bg-muted mr-12"
                  }`}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              ))}
              {isLoading && (
                <div className="bg-muted p-4 rounded-lg mr-12">思考中...</div>
              )}
            </div>
          </ScrollArea>
        </Card>

        <div className="flex gap-1 mt-1">
          <Input
            placeholder="输入消息..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            disabled={connectionStatus !== "connected"}
          />
          <Button
            onClick={handleClearHistory}
            disabled={messages.length === 0}
            variant="outline"
            className="ml-1"
          >
            清空历史
          </Button>
          <Button
            onClick={handleSend}
            disabled={isLoading || !apiKey || connectionStatus !== "connected"}
          >
            发送
          </Button>
        </div>
      </div>
    </TabsContent>
  );
};

export default LLMTab;
