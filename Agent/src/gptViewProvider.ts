import * as vscode from "vscode";
const axios = require("axios").default;
import { conversationManager, ResponseType, LanguageMap } from "./globals";

export class GptViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "CoSEFA.chatView";
	private _view?: vscode.WebviewView;

	private url: string;
	private model: string;
	private stream_rec: boolean = false;  // default to false for non-streaming mode


	public message: string = "";
	public msgType: ResponseType = "freeform";
	public langId: string = "";

	public pasteOnClick: boolean = true;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		url: string,
		model: string,
		stream_rec: boolean 
	) {
		this.url = url;
		this.model = model;
		this.stream_rec = stream_rec;
	}

	// 添加修改 URL 的方法
	public setUrl(newUrl: string) {
		this.url = newUrl;
	}

	// 添加修改 Model 的方法
	public setModel(newModel: string) {
		this.model = newModel;
	}

	public setStreamMode(mode: boolean) {
		this.stream_rec = mode;
	}

	public handleStartNewConversation() {
		this._view?.webview.postMessage({ type: "clearChat" });
	}

	public handleLoadConversation() {
		this._view?.webview.postMessage({
			type: "loadConversation",
			messages: conversationManager.getCurrentConversation(),
		});
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext<unknown>,
		_token: vscode.CancellationToken
	): void | Thenable<void> {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};

		// 定义webview HTML
		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		// 接收webview message
		webviewView.webview.onDidReceiveMessage(async (data) => {
			switch (data.type) {
				case "codeSelected": {
					if (!this.pasteOnClick) {
						break;
					}

					let code = data.value;
					code = code.replace(/([^\\])(\$)([^{0-9])/g, "$1\\$$$3");

					vscode.window.activeTextEditor?.insertSnippet(
						new vscode.SnippetString(code)
					);
					break;
				}
				case "prompt": {
					this.msgType = "freeform";
					this.message = data.value;
					this.conversation();
					break;
				}
				case "saveToFile": {
					const code = data.value;
					const fileName = await vscode.window.showInputBox({
						placeHolder: "Enter filename",
						prompt: "Please input the filename to save",
					});
					if (fileName) {
						if (vscode.workspace.workspaceFolders) {
							const newFilePath = vscode.Uri.joinPath(
								vscode.workspace.workspaceFolders[0].uri,
								fileName
							);
							await vscode.workspace.fs.writeFile(
								newFilePath,
								Buffer.from(code, "utf8")
							);
							vscode.window.showInformationMessage(
								 `Code saved to ${newFilePath.fsPath}`
							);
							const document = await vscode.workspace.openTextDocument(
								newFilePath
							);
							await vscode.window.showTextDocument(document);
						} else {
							vscode.window.showErrorMessage("No workspace folder is open.");
						}
					} else {
						vscode.window.showErrorMessage("Filename cannot be empty");
					}
					break;
				}
				case "clear": {
					conversationManager.clearCurrentConversation();
					vscode.window.showInformationMessage("Current conversation cleared");
					break;
				}
			}
		});
	}

	private _getPayload() {
		const editor = vscode.window.activeTextEditor!;
		if (!editor) {
			vscode.window.showWarningMessage("GPTINT: Please open a code file before starting a conversation!");
			return false;
		}
		// 添加用户消息到当前会话
		conversationManager.addMessage("user", this.message);
		if (!conversationManager.getCurrentConversationLabel()) {
			conversationManager.setCurrentConversationLabel(
				this.message.trim().substring(0, 20)
			);
		}
		const langType = editor.document.languageId;
		const data = {
			model: this.model,
			messages: conversationManager.getCurrentConversation(),
			stream: true,
			langid: LanguageMap[langType],
		};

		return data;
	}

	public async conversation() {
		const payload = this._getPayload();
		if (!payload) {
			return;
		}
		console.log("payloadInfo", payload);

		// focus gpt activity from activity bar
		if (!this._view) {
			await vscode.commands.executeCommand("CoSEFA.chatView.focus");
		} else {
			this._view?.show?.(true);
		}

		this._view?.webview.postMessage({
			type: "addQuestion",
			value: this.message,
			msgType: this.msgType,
			fileName: vscode.window.activeTextEditor?.document.fileName,
		});

		try {
			if (this.stream_rec) {
				// 流式接收模式
				const response = await axios.request({
					method: "POST",
					url: this.url,
					data: payload,
					responseType: "stream",
				});
				this._streamSource(response.data);
			} else {
				// 非流式接收模式
				const response = await axios.request({
					method: "POST",
					url: this.url,
					data: payload,
				});
				const content = response.data.choices[0].message.content;
				this._simulateStreamDisplay(content);
			}
		} catch (e: any) {
			console.error("Error fetching data:", e);
			return;
		}
	}

	private _simulateStreamDisplay(content: string) {
		const chunkSize = 10; // 每次显示的字符数
		let displayedContent = "";
		let currentIndex = 0;

		const simulateStream = setInterval(() => {
			if (currentIndex >= content.length) {
				clearInterval(simulateStream);
				// 显示完成后的处理
				this._view?.webview.postMessage({
					type: "showInput",
					value: null,
				});
				conversationManager.addMessage("assistant", content);
				conversationManager.saveCurrentConversation();
				return;
			}

			// 添加新的内容片段
			const chunk = content.slice(currentIndex, currentIndex + chunkSize);
			displayedContent += chunk;
			currentIndex += chunkSize;

			this._view?.webview.postMessage({
				type: "addAnswer",
				value: displayedContent,
			});
		}, 50); // 每50毫秒更新一次显示
	}

	private _streamSource(stream: any) {
		let content = "";
		stream.on("data", (chunk: any) => {
			const lines = chunk.toString().trim().split("\n");
			console.log(lines);
			// 在编辑器光标处插入代码
			for (const line of lines) {
				if (line === "") {
					continue;
				}
				// console.log(line);
				const jsonString = line.replace(/^data: /, "");
				// console.log(jsonString);

				try {
					const parsed = JSON.parse(jsonString);
					// console.log(parsed);
					content += parsed.message.content;
				} catch (e) {
					console.log("Error parsing JSON", jsonString);
					return;
				}

				this._view?.webview.postMessage({
					type: "addAnswer",
					value: content,
				});
			}
		});

		stream.on("end", () => {
			this._view?.webview.postMessage({
				type: "showInput",
				value: null,
			});
			// 添加回复到当前会话
			conversationManager.addMessage("assistant", content);
			conversationManager.saveCurrentConversation();
			console.log("Stream ended.");
		});

		stream.on("error", (err: any) => {
			this._view?.webview.postMessage({
				type: "showInput",
				value: "Something went wrong. Please try again...",
			});
			console.error("Abnormal Disconnection");
			return;
		});
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		const mainScriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "media", "main.js")
		);

		const tailwindScriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "media", "tailwind.min.js")
		);
		const highlightScriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "media", "highlight.min.js")
		);

		const markedScriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "media", "marked.min.js")
		);

		const highlightStyleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "media", "atom-one-dark.min.css")
		);

		const mainStyleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "media", "main.style.css")
		);

		const pointerSvg = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "resources", "pointer.svg")
		);

		return 	`<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>AI Chat Interface</title>
				<script src="${tailwindScriptUri}"></script>
				<script src="${highlightScriptUri}"></script>
				<script src="${markedScriptUri}"></script>
				<link rel="stylesheet" href="${highlightStyleUri}">
				<link rel="stylesheet" href="${mainStyleUri}">
			</head>
			<body class="font-sans">
				<div class="flex h-screen antialiased">
					<div class="flex flex-col flex-auto h-full bg-[#282C34] overflow-hidden">
						<div class="flex flex-col flex-auto flex-shrink-0 h-full p-4">
							<div
								id="chat-box"
								class="message-box flex flex-col h-full overflow-x-auto mb-2 bg-[#21252B] rounded-lg p-4"
							>
								<!-- Messages will be inserted here -->
							</div>
							<div class="flex flex-row items-center justify-center space-x-4 mb-2">
								<button
									id="stop-response"
									class="bg-[#E06C75] text-[#282C34] font-bold py-2 px-6 rounded-full hover:bg-[#E06C75]/80 transition duration-300 ease-in-out transform hover:scale-105 hidden"
								>
									Stop
								</button>
							</div>
							<div
								id="bottom-box"
								class="flex flex-row items-center rounded-xl bg-[#282C34] w-full px-1 border-2 border-[#3E4451] py-2 focus-within:border-[#98C379]"
							>
								<div class="flex item-center grow ml-2">
									<textarea
										id="prompt-input"
										class="text-base w-full bg-[#282C34] text-[#ABB2BF] border-none resize-none rounded-xl pl-1 focus:outline-none auto-resize-textarea"
										placeholder="Enter Your Message Here..."
										rows="1"
									></textarea>
								</div>
								<div class="flex item-center ml-4">
									<button
										id="send-btn"
										class="send-button flex items-center justify-center bg-[#98C379] hover:bg-[#98C379]/80 rounded-full text-[#282C34] px-2 py-2 flex-shrink-0 transition duration-300 ease-in-out transform hover:scale-105"
									>
										<svg
											class="w-5 h-5 transform rotate-45 -mt-px"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
											></path>
										</svg>
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</body>
		<script src="${mainScriptUri}"></script>
		</html>
		`;
	}
}
