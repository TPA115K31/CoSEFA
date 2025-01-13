import * as vscode from "vscode";
import { GptViewProvider } from "./gptViewProvider";

export const PresetPrompt: { [key: string]: string } = {
	Prompt_explainCode: "# Explain the following code: \n",
	Prompt_generateCodeComment:
		"# Generate Chinese code comments for the following code, and return it in the form of code snippets: \n",
	Prompt_generateCodeUnitTest: "# Generate a unit test for the following code, returned as a snippet: \n",
	Prompt_generateCodeVulnerabilityDetection: "# Perform vulnerability detection for the following code: \n",
};

export function updatePresetPrompts(config: vscode.WorkspaceConfiguration) {
	Object.keys(PresetPrompt).forEach((key) => {
		PresetPrompt[key] = config.get(key, PresetPrompt[key]);
	});
}

function updateProviderConfig(
	updatedConfig: vscode.WorkspaceConfiguration,
	provider: GptViewProvider
) {
	const newUrl =
		updatedConfig.get("RemoteUrl", "http://localhost:8000/api/chat").trim();
	const newModel = updatedConfig
		.get("model", "qwen2.5-coder:7b-instruct")
		.trim();
	const newStreamRec = updatedConfig.get("stream_rec", false);
	provider.setUrl(newUrl);
	provider.setModel(newModel);
	provider.setStreamMode(newStreamRec);
}

// 新增: 设置配置变更监听
export function setupConfigurationChangeListener(provider: GptViewProvider) {
	vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration("CoSEFA")) {
			const updatedConfig = vscode.workspace.getConfiguration("CoSEFA");
			// 更新配置变量
			updatePresetPrompts(updatedConfig);
			updateProviderConfig(updatedConfig, provider);
			// 配置更改提示
			vscode.window.showInformationMessage("CoSEFA configuration updated");
		}
	});
}
