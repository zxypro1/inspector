import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
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
import { Tool } from "@modelcontextprotocol/sdk/types.js";

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
const params = new URLSearchParams(window.location.search);
const PROXY_PORT = params.get("proxyPort") ?? "3000";
const PROXY_SERVER_URL = `http://${window.location.hostname}:${PROXY_PORT}`;

const LLMTab = ({
  tools = [],
  callTool,
  connectionStatus,
}: {
  tools: Tool[];
  callTool: (name: string, params: Record<string, unknown>) => void;
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
    const historyPaneElement = document.querySelector(".relative.border-t.border-border") as HTMLElement;
    if (!historyPaneElement) return;
    
    if (isInitialMount.current) {
      // 首次挂载时保存当前高度
      const heightStyle = historyPaneElement.style.height;
      const currentHeight = heightStyle ? parseInt(heightStyle.replace("px", "")) : 300;
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

  const handleToolCall = async (toolCalls: ToolCall[]) => {
    const toolResults = [];

    for (const toolCall of toolCalls) {
      if (toolCall.type === "function") {
        const functionCall = toolCall.function;
        const toolName = functionCall.name;
        try {
          const toolParams = JSON.parse(functionCall.arguments as string);
          await callTool(toolName, toolParams);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: toolName,
            content: JSON.stringify({ result: "工具调用成功" }),
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

  const handleQianwenToolCalls = async (toolCalls: ApiToolCall[]) => {
    const toolResults = [];

    for (const toolCall of toolCalls) {
      if (toolCall.type === "function" && toolCall.function) {
        const functionCall = toolCall.function;
        const toolName = functionCall.name;
        try {
          const toolParams = typeof functionCall.arguments === "string" 
            ? JSON.parse(functionCall.arguments) 
            : functionCall.arguments;
          
          await callTool(toolName, toolParams);
          toolResults.push({
            role: "tool",
            name: toolName,
            content: JSON.stringify({ result: "工具调用成功" }),
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

    setMessages((prev) => [...prev, newMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const modelConfig = getCurrentModelConfig();
      let assistantMessage: Message;

      if (modelConfig.provider === "openai") {
        const proxyResponse = await proxyFetch(modelConfig.apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [...messages, newMessage].map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            tools: formatToolsForModel(tools, "openai"),
            tool_choice: "auto",
          }),
        });

        const data = await proxyResponse.json();

        if (!proxyResponse.ok) {
          throw new Error(data.error?.message || "请求失败");
        }

        const assistantResponse = data.choices[0].message;

        // 处理工具调用
        if (
          assistantResponse.tool_calls &&
          assistantResponse.tool_calls.length > 0
        ) {
          // 添加助手消息到对话中
          assistantMessage = {
            role: "assistant",
            content:
              assistantResponse.content || "我需要使用工具来回答这个问题...",
          };
          setMessages((prev) => [...prev, assistantMessage]);

          // 处理工具调用并获取结果
          const toolResults = await handleToolCall(
            assistantResponse.tool_calls,
          );

          // 继续对话，包含工具调用结果
          const followUpProxyResponse = await proxyFetch(modelConfig.apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: selectedModel,
              messages: [
                ...messages,
                newMessage,
                assistantResponse,
                ...toolResults,
              ],
              tools: formatToolsForModel(tools, "openai"),
              tool_choice: "auto",
            }),
          });

          const followUpData = await followUpProxyResponse.json();

          if (!followUpProxyResponse.ok) {
            throw new Error(
              followUpData.error?.message || "工具调用后请求失败",
            );
          }

          // 对于OpenAI，使用直接的响应结构
          assistantMessage = {
            role: "assistant",
            content: followUpData.choices?.[0]?.message?.content || "无响应内容",
          };
        } else {
          assistantMessage = {
            role: "assistant",
            content: assistantResponse.content,
          };
        }
      } else if (modelConfig.provider === "qianwen") {
        // 千问使用DashScope格式的API
        const proxyResponse = await proxyFetch(modelConfig.apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: selectedModel,
            input: {
              messages: [
                ...formatMessagesForQianwen(messages),
                { role: "user", content: inputMessage },
              ],
            },
            parameters: {
              result_format: "message",
              tools: formatToolsForModel(tools, "qianwen"),
              tool_choice: "auto",
            },
          }),
        });

        const data = await proxyResponse.json();

        if (!proxyResponse.ok || data.code) {
          throw new Error(data.message || data.code || "请求失败");
        }

        // 千问API响应格式处理
        const assistantResponse = data.output?.choices?.[0]?.message || data.output?.choice;
        if (!assistantResponse) {
          throw new Error("无法从响应中获取助手消息");
        }

        // 处理千问工具调用
        if (
          assistantResponse.tool_calls &&
          assistantResponse.tool_calls.length > 0
        ) {
          // 添加助手消息到对话中
          assistantMessage = {
            role: "assistant",
            content:
              assistantResponse.content || "我需要使用工具来回答这个问题...",
          };
          setMessages((prev) => [...prev, assistantMessage]);

          // 处理工具调用并获取结果
          const toolResults = await handleQianwenToolCalls(
            assistantResponse.tool_calls,
          );

          // 继续对话，包含工具调用结果
          const followUpMessages = [
            ...formatMessagesForQianwen(messages),
            { role: "user", content: inputMessage },
            {
              role: "assistant",
              content: assistantMessage.content,
              tool_calls: assistantResponse.tool_calls,
            },
            ...toolResults,
          ];

          const followUpProxyResponse = await proxyFetch(modelConfig.apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: selectedModel,
              input: {
                messages: followUpMessages,
              },
              parameters: {
                result_format: "message",
                tools: formatToolsForModel(tools, "qianwen"),
                tool_choice: "auto",
              },
            }),
          });

          const followUpData = await followUpProxyResponse.json();

          if (!followUpProxyResponse.ok || followUpData.code) {
            throw new Error(
              followUpData.message || followUpData.code || "工具调用后请求失败",
            );
          }

          const followUpAssistantMessage = followUpData.output?.choices?.[0]?.message || followUpData.output?.choice;
          if (!followUpAssistantMessage) {
            throw new Error("无法从后续响应中获取助手消息");
          }
          
          assistantMessage = {
            role: "assistant",
            content: followUpAssistantMessage.content || "无响应内容",
          };
        } else {
          assistantMessage = {
            role: "assistant",
            content: assistantResponse.content,
          };
        }
      }

      setMessages((prev) => [...prev, assistantMessage]);
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
                  className={`p-4 rounded-lg ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground ml-12"
                      : "bg-muted mr-12"
                  }`}
                >
                  {message.content}
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
