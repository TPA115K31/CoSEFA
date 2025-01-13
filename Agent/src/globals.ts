import * as vscode from "vscode";
import { GptViewProvider } from "./gptViewProvider";
import { ConversationManager } from "./conversationManager";
import {
	updatePresetPrompts,
	setupConfigurationChangeListener,
} from "./configManager";

export type Message = {
	role: "user" | "assistant";
	content: string;
};

export const LanguageMap: { [key: string]: string } = {
	python: "py",
	c: "c",
	javascript: "js",
	typescript: "ts",
	java: "java",
	rust: "rs",
	go: "go",
	ruby: "rb",
};

export type ResponseType =
	| "idk"
	| "freeform"
	| "generate"
	| "edit"
	| "chat_edit"
	| "lsp_edit";

let gptViewProvider: GptViewProvider;
let conversationManager: ConversationManager;

export function initializeGlobals(context: vscode.ExtensionContext) {
	// 加载配置
	const config = vscode.workspace.getConfiguration("CoSEFA");
	updatePresetPrompts(config);

	// 实例化 conversationManager
	conversationManager = new ConversationManager();

	// 创建GptViewProvider
	gptViewProvider = new GptViewProvider(
		context.extensionUri,
		config.get("RemoteUrl", "http://localhost:8000/v1/chat/completions").trim(),
		config.get("model", "qwen2.5-coder:7b-instruct"),
		config.get("stream_rec", false)
	);
	// 配置变更事件检测
	setupConfigurationChangeListener(gptViewProvider);
}

export function finishGlobals() {
	// 保存会话数据到本地文件
	const fs = require("fs");
	const conversationHistory = conversationManager.getConversationHistory();
	const dataFilePath = conversationManager.getDataFilePath();
	fs.writeFileSync(dataFilePath, JSON.stringify(conversationHistory, null, 2));
}

export { gptViewProvider, conversationManager };
