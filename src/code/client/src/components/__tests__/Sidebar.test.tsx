import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, beforeEach, jest } from "@jest/globals";
import Sidebar from "../Sidebar";
import { DEFAULT_INSPECTOR_CONFIG } from "../../lib/constants";
import { InspectorConfig } from "../../lib/configurationTypes";

// Mock theme hook
jest.mock("../../lib/useTheme", () => ({
  __esModule: true,
  default: () => ["light", jest.fn()],
}));

describe("Sidebar Environment Variables", () => {
  const defaultProps = {
    connectionStatus: "disconnected" as const,
    transportType: "stdio" as const,
    setTransportType: jest.fn(),
    command: "",
    setCommand: jest.fn(),
    args: "",
    setArgs: jest.fn(),
    sseUrl: "",
    setSseUrl: jest.fn(),
    env: {},
    setEnv: jest.fn(),
    bearerToken: "",
    setBearerToken: jest.fn(),
    onConnect: jest.fn(),
    stdErrNotifications: [],
    logLevel: "info" as const,
    sendLogLevelRequest: jest.fn(),
    loggingSupported: true,
    config: DEFAULT_INSPECTOR_CONFIG,
    setConfig: jest.fn(),
  };

  const renderSidebar = (props = {}) => {
    return render(<Sidebar {...defaultProps} {...props} />);
  };

  const openEnvVarsSection = () => {
    const button = screen.getByText("Environment Variables");
    fireEvent.click(button);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Operations", () => {
    it("should add a new environment variable", () => {
      const setEnv = jest.fn();
      renderSidebar({ env: {}, setEnv });

      openEnvVarsSection();

      const addButton = screen.getByText("Add Environment Variable");
      fireEvent.click(addButton);

      expect(setEnv).toHaveBeenCalledWith({ "": "" });
    });

    it("should remove an environment variable", () => {
      const setEnv = jest.fn();
      const initialEnv = { TEST_KEY: "test_value" };
      renderSidebar({ env: initialEnv, setEnv });

      openEnvVarsSection();

      const removeButton = screen.getByRole("button", { name: "×" });
      fireEvent.click(removeButton);

      expect(setEnv).toHaveBeenCalledWith({});
    });

    it("should update environment variable value", () => {
      const setEnv = jest.fn();
      const initialEnv = { TEST_KEY: "test_value" };
      renderSidebar({ env: initialEnv, setEnv });

      openEnvVarsSection();

      const valueInput = screen.getByDisplayValue("test_value");
      fireEvent.change(valueInput, { target: { value: "new_value" } });

      expect(setEnv).toHaveBeenCalledWith({ TEST_KEY: "new_value" });
    });

    it("should toggle value visibility", () => {
      const initialEnv = { TEST_KEY: "test_value" };
      renderSidebar({ env: initialEnv });

      openEnvVarsSection();

      const valueInput = screen.getByDisplayValue("test_value");
      expect(valueInput).toHaveProperty("type", "password");

      const toggleButton = screen.getByRole("button", { name: /show value/i });
      fireEvent.click(toggleButton);

      expect(valueInput).toHaveProperty("type", "text");
    });
  });

  describe("Key Editing", () => {
    it("should maintain order when editing first key", () => {
      const setEnv = jest.fn();
      const initialEnv = {
        FIRST_KEY: "first_value",
        SECOND_KEY: "second_value",
        THIRD_KEY: "third_value",
      };
      renderSidebar({ env: initialEnv, setEnv });

      openEnvVarsSection();

      const firstKeyInput = screen.getByDisplayValue("FIRST_KEY");
      fireEvent.change(firstKeyInput, { target: { value: "NEW_FIRST_KEY" } });

      expect(setEnv).toHaveBeenCalledWith({
        NEW_FIRST_KEY: "first_value",
        SECOND_KEY: "second_value",
        THIRD_KEY: "third_value",
      });
    });

    it("should maintain order when editing middle key", () => {
      const setEnv = jest.fn();
      const initialEnv = {
        FIRST_KEY: "first_value",
        SECOND_KEY: "second_value",
        THIRD_KEY: "third_value",
      };
      renderSidebar({ env: initialEnv, setEnv });

      openEnvVarsSection();

      const middleKeyInput = screen.getByDisplayValue("SECOND_KEY");
      fireEvent.change(middleKeyInput, { target: { value: "NEW_SECOND_KEY" } });

      expect(setEnv).toHaveBeenCalledWith({
        FIRST_KEY: "first_value",
        NEW_SECOND_KEY: "second_value",
        THIRD_KEY: "third_value",
      });
    });

    it("should maintain order when editing last key", () => {
      const setEnv = jest.fn();
      const initialEnv = {
        FIRST_KEY: "first_value",
        SECOND_KEY: "second_value",
        THIRD_KEY: "third_value",
      };
      renderSidebar({ env: initialEnv, setEnv });

      openEnvVarsSection();

      const lastKeyInput = screen.getByDisplayValue("THIRD_KEY");
      fireEvent.change(lastKeyInput, { target: { value: "NEW_THIRD_KEY" } });

      expect(setEnv).toHaveBeenCalledWith({
        FIRST_KEY: "first_value",
        SECOND_KEY: "second_value",
        NEW_THIRD_KEY: "third_value",
      });
    });

    it("should maintain order during key editing", () => {
      const setEnv = jest.fn();
      const initialEnv = {
        KEY1: "value1",
        KEY2: "value2",
      };
      renderSidebar({ env: initialEnv, setEnv });

      openEnvVarsSection();

      // Type "NEW_" one character at a time
      const key1Input = screen.getByDisplayValue("KEY1");
      "NEW_".split("").forEach((char) => {
        fireEvent.change(key1Input, {
          target: { value: char + "KEY1".slice(1) },
        });
      });

      // Verify the last setEnv call maintains the order
      const lastCall = setEnv.mock.calls[
        setEnv.mock.calls.length - 1
      ][0] as Record<string, string>;
      const entries = Object.entries(lastCall);

      // The values should stay with their original keys
      expect(entries[0][1]).toBe("value1"); // First entry should still have value1
      expect(entries[1][1]).toBe("value2"); // Second entry should still have value2
    });
  });

  describe("Multiple Operations", () => {
    it("should maintain state after multiple key edits", () => {
      const setEnv = jest.fn();
      const initialEnv = {
        FIRST_KEY: "first_value",
        SECOND_KEY: "second_value",
      };
      const { rerender } = renderSidebar({ env: initialEnv, setEnv });

      openEnvVarsSection();

      // First key edit
      const firstKeyInput = screen.getByDisplayValue("FIRST_KEY");
      fireEvent.change(firstKeyInput, { target: { value: "NEW_FIRST_KEY" } });

      // Get the updated env from the first setEnv call
      const updatedEnv = setEnv.mock.calls[0][0] as Record<string, string>;

      // Rerender with the updated env
      rerender(<Sidebar {...defaultProps} env={updatedEnv} setEnv={setEnv} />);

      // Second key edit
      const secondKeyInput = screen.getByDisplayValue("SECOND_KEY");
      fireEvent.change(secondKeyInput, { target: { value: "NEW_SECOND_KEY" } });

      // Verify the final state matches what we expect
      expect(setEnv).toHaveBeenLastCalledWith({
        NEW_FIRST_KEY: "first_value",
        NEW_SECOND_KEY: "second_value",
      });
    });

    it("should maintain visibility state after key edit", () => {
      const initialEnv = { TEST_KEY: "test_value" };
      const { rerender } = renderSidebar({ env: initialEnv });

      openEnvVarsSection();

      // Show the value
      const toggleButton = screen.getByRole("button", { name: /show value/i });
      fireEvent.click(toggleButton);

      const valueInput = screen.getByDisplayValue("test_value");
      expect(valueInput).toHaveProperty("type", "text");

      // Edit the key
      const keyInput = screen.getByDisplayValue("TEST_KEY");
      fireEvent.change(keyInput, { target: { value: "NEW_KEY" } });

      // Rerender with updated env
      rerender(<Sidebar {...defaultProps} env={{ NEW_KEY: "test_value" }} />);

      // Value should still be visible
      const updatedValueInput = screen.getByDisplayValue("test_value");
      expect(updatedValueInput).toHaveProperty("type", "text");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty key", () => {
      const setEnv = jest.fn();
      const initialEnv = { TEST_KEY: "test_value" };
      renderSidebar({ env: initialEnv, setEnv });

      openEnvVarsSection();

      const keyInput = screen.getByDisplayValue("TEST_KEY");
      fireEvent.change(keyInput, { target: { value: "" } });

      expect(setEnv).toHaveBeenCalledWith({ "": "test_value" });
    });

    it("should handle special characters in key", () => {
      const setEnv = jest.fn();
      const initialEnv = { TEST_KEY: "test_value" };
      renderSidebar({ env: initialEnv, setEnv });

      openEnvVarsSection();

      const keyInput = screen.getByDisplayValue("TEST_KEY");
      fireEvent.change(keyInput, { target: { value: "TEST-KEY@123" } });

      expect(setEnv).toHaveBeenCalledWith({ "TEST-KEY@123": "test_value" });
    });

    it("should handle unicode characters", () => {
      const setEnv = jest.fn();
      const initialEnv = { TEST_KEY: "test_value" };
      renderSidebar({ env: initialEnv, setEnv });

      openEnvVarsSection();

      const keyInput = screen.getByDisplayValue("TEST_KEY");
      fireEvent.change(keyInput, { target: { value: "TEST_🔑" } });

      expect(setEnv).toHaveBeenCalledWith({ "TEST_🔑": "test_value" });
    });

    it("should handle very long key names", () => {
      const setEnv = jest.fn();
      const initialEnv = { TEST_KEY: "test_value" };
      renderSidebar({ env: initialEnv, setEnv });

      openEnvVarsSection();

      const keyInput = screen.getByDisplayValue("TEST_KEY");
      const longKey = "A".repeat(100);
      fireEvent.change(keyInput, { target: { value: longKey } });

      expect(setEnv).toHaveBeenCalledWith({ [longKey]: "test_value" });
    });
  });

  describe("Configuration Operations", () => {
    const openConfigSection = () => {
      const button = screen.getByText("Configuration");
      fireEvent.click(button);
    };

    it("should update MCP server request timeout", () => {
      const setConfig = jest.fn();
      renderSidebar({ config: DEFAULT_INSPECTOR_CONFIG, setConfig });

      openConfigSection();

      const timeoutInput = screen.getByTestId(
        "MCP_SERVER_REQUEST_TIMEOUT-input",
      );
      fireEvent.change(timeoutInput, { target: { value: "5000" } });

      expect(setConfig).toHaveBeenCalledWith({
        MCP_SERVER_REQUEST_TIMEOUT: {
          description: "Timeout for requests to the MCP server (ms)",
          value: 5000,
        },
      });
    });

    it("should handle invalid timeout values entered by user", () => {
      const setConfig = jest.fn();
      renderSidebar({ config: DEFAULT_INSPECTOR_CONFIG, setConfig });

      openConfigSection();

      const timeoutInput = screen.getByTestId(
        "MCP_SERVER_REQUEST_TIMEOUT-input",
      );
      fireEvent.change(timeoutInput, { target: { value: "abc1" } });

      expect(setConfig).toHaveBeenCalledWith({
        MCP_SERVER_REQUEST_TIMEOUT: {
          description: "Timeout for requests to the MCP server (ms)",
          value: 0,
        },
      });
    });

    it("should maintain configuration state after multiple updates", () => {
      const setConfig = jest.fn();
      const { rerender } = renderSidebar({
        config: DEFAULT_INSPECTOR_CONFIG,
        setConfig,
      });

      openConfigSection();

      // First update
      const timeoutInput = screen.getByTestId(
        "MCP_SERVER_REQUEST_TIMEOUT-input",
      );
      fireEvent.change(timeoutInput, { target: { value: "5000" } });

      // Get the updated config from the first setConfig call
      const updatedConfig = setConfig.mock.calls[0][0] as InspectorConfig;

      // Rerender with the updated config
      rerender(
        <Sidebar
          {...defaultProps}
          config={updatedConfig}
          setConfig={setConfig}
        />,
      );

      // Second update
      const updatedTimeoutInput = screen.getByTestId(
        "MCP_SERVER_REQUEST_TIMEOUT-input",
      );
      fireEvent.change(updatedTimeoutInput, { target: { value: "3000" } });

      // Verify the final state matches what we expect
      expect(setConfig).toHaveBeenLastCalledWith({
        MCP_SERVER_REQUEST_TIMEOUT: {
          description: "Timeout for requests to the MCP server (ms)",
          value: 3000,
        },
      });
    });
  });
});
