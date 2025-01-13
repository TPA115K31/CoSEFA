import * as vscode from "vscode";
import { PresetPrompt } from "./configManager";
import { GptViewProvider } from "./gptViewProvider";
import { ConversationManager } from "./conversationManager";
import { LanguageMap } from "./globals";
import { gptViewProvider, conversationManager } from "./globals";

export function registerCommands(context: vscode.ExtensionContext) {
	const gptDispose = vscode.window.registerWebviewViewProvider(
		GptViewProvider.viewType,
		gptViewProvider,
		{
			webviewOptions: {
				retainContextWhenHidden: true,
			},
		}
	);

	const helloworldDispose = vscode.commands.registerCommand(
		"CoSEFA.helloWorld",
		() => {
			vscode.window.showInformationMessage("Hello World from CoSEFA-rebuild!");
		}
	);

	const textCommandConfigs = [
		{ command: "CoSEFA.getCode", handler: handleGetCode },
		{ command: "CoSEFA.explainCode", handler: handleExplainCode },
		{
			command: "CoSEFA.generateCodeComment",
			handler: handleGenerateCodeComment,
		},
		{
			command: "CoSEFA.generateCodeUnitTest",
			handler: handleGenerateCodeUnitTest,
		},
		{
			command: "CoSEFA.generateCodeVulnerabilityDetection",
			handler: handleGenerateCodeVulnerabilityDetection,
		},
		{
			command: "CoSEFA.secureGenerate",
			handler: handleSecureGenerate,
		}
	];

	const disposables = textCommandConfigs.map((config) =>
		vscode.commands.registerTextEditorCommand(
			config.command,
			config.handler.bind(null, gptViewProvider)
		)
	);

	const additionalCommands = [
		{ command: "CoSEFA.newConversation", handler: handleNewConversation },
		{ command: "CoSEFA.showHistory", handler: handleShowHistory },
	];

	const additionalDisposables = additionalCommands.map((config) =>
		vscode.commands.registerCommand(
			config.command,
			config.handler.bind(null, conversationManager, gptViewProvider)
		)
	);

	context.subscriptions.push(
		helloworldDispose,
		gptDispose,
		...disposables,
		...additionalDisposables
	);
}
/*TextCommand Functions*/
function handleGetCode(provider: GptViewProvider, editor: vscode.TextEditor) {
	const selected = editor.document.getText(editor.selection);
	const langType = editor.document.languageId;
	console.log(LanguageMap[langType]);
}

function handleExplainCode(
	provider: GptViewProvider,
	editor: vscode.TextEditor
) {
	const selected = editor.document.getText(editor.selection);
	console.log("explainCode");
	const d_message = PresetPrompt.Prompt_explainCode + selected;
	provider.msgType = "freeform";
	provider.message = d_message;
	provider.conversation();
}

function handleSecureGenerate(
	provider: GptViewProvider,
	editor: vscode.TextEditor
) {
	const selected = editor.document.getText(editor.selection);
	console.log("secureGenerate");
	const d_message = selected;
	provider.msgType = "freeform";
	provider.message = d_message;
	provider.conversation();
}

function handleGenerateCodeComment(
	provider: GptViewProvider,
	editor: vscode.TextEditor
) {
	const selected = editor.document.getText(editor.selection);
	console.log("generateCodeComment");
	const d_message = PresetPrompt.Prompt_generateCodeComment + selected;
	provider.msgType = "freeform";
	provider.message = d_message;
	provider.conversation();
}

function handleGenerateCodeUnitTest(
	provider: GptViewProvider,
	editor: vscode.TextEditor
) {
	const selected = editor.document.getText(editor.selection);
	console.log("generateCodeUnitTest");
	const d_message = PresetPrompt.Prompt_generateCodeUnitTest + selected;
	provider.msgType = "freeform";
	provider.message = d_message;
	provider.conversation();
}

function handleGenerateCodeVulnerabilityDetection(
	provider: GptViewProvider,
	editor: vscode.TextEditor
) {
	const selected = editor.document.getText(editor.selection);
	console.log("generateCodeVulnerabilityDetection");
	const d_message =
		PresetPrompt.Prompt_generateCodeVulnerabilityDetection + selected;
	provider.msgType = "freeform";
	provider.message = d_message;
	provider.conversation();
}

/*History&Conversation Command Functions*/
function handleNewConversation(
	manager: ConversationManager,
	provider: GptViewProvider
) {
	manager.saveCurrentConversation();
	manager.startNewConversation();
	provider.handleStartNewConversation();
}

async function handleShowHistory(
	manager: ConversationManager,
	provider: GptViewProvider
) {
	// 创建并配置 QuickPick
	let quickPick = vscode.window.createQuickPick();
	updateQuickPickItems(quickPick, manager);
	quickPick.placeholder = "Select a history conversation";

	quickPick.onDidTriggerItemButton(async (e) => {
		const idMatch = e.item.label.match(/#(\d+)/);
		const conversationId = idMatch ? parseInt(idMatch[1]) : null;
		if (conversationId === null) {
			vscode.window.showErrorMessage("Fail to get session ID");
			return;
		}
		if (e.button.tooltip === "Rename Session") {
			const newName = await vscode.window.showInputBox({
				prompt: "Enter new conversation name",
				value: e.item.label.replace(/ \(#\d+\)$/, ""), // 去除 #id
			});
			if (newName) {
				conversationManager.renameConversation(conversationId, newName);
				vscode.window.showInformationMessage(`Renamed to: ${newName} successfully`);
				updateQuickPickItems(quickPick, manager);
			}
		} else if (e.button.tooltip === "Delete Session") {
			conversationManager.deleteConversation(conversationId);
			vscode.window.showInformationMessage("Conversation deleted successfully");
			updateQuickPickItems(quickPick, manager);
		}
	});

	quickPick.onDidAccept(() => {
		const selected = quickPick.selectedItems[0];
		if (selected) {
			const idMatch = selected.label.match(/#(\d+)/);
			const conversationId = idMatch ? parseInt(idMatch[1]) : null;
			console.log(conversationId);
			if (conversationId !== null) {
				manager.loadConversation(conversationId);
				provider.handleLoadConversation();
			} else {
				vscode.window.showErrorMessage("Fail to get session ID");
			}
		}
		quickPick.dispose();
	});

	quickPick.onDidHide(() => {
		quickPick.dispose();
	});

	quickPick.show();
}

function updateQuickPickItems(
	quickPick: vscode.QuickPick<vscode.QuickPickItem>,
	manager: ConversationManager
) {
	const historyItems = manager.getConversationHistoryItems();
	const currentConversationId = manager.getCurrentConversationId();
	quickPick.items = historyItems.map((item) => {
		const isCurrent = item.id === currentConversationId;
		const labelWithId = `${item.label}(#${item.id})`;
		return {
			label: labelWithId,
			buttons: [
				{
					iconPath: new vscode.ThemeIcon("edit"),
					tooltip: "Rename Session",
				},
				...(!isCurrent
					? [
							{
								iconPath: new vscode.ThemeIcon("trash"),
								tooltip: "Delete Session",
							},
					  ]
					: []),
			],
			...(isCurrent ? { description: "(current)" } : {}),
		};
	});
}
