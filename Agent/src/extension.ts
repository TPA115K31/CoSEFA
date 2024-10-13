import * as vscode from "vscode";
const axios = require("axios").default;

type Message = {
	role: "user" | "assistant";
	content: string;
};
type ResponseType = "freeform" | "generate";
const LanguageMap: { [key: string]: string } = {
	python: "py",
	C: "c",
	javascript: "js",
	typescript: "ts",
	java: "java",
	rust: "rs",
	go: "go",
	ruby: "rb",
};
let GlobalconversationHistory: Message[] = []; // Global conversation history

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "CoSEFA" is now active!');

	// webviewprovider定义
	const provider = new CoSEFAViewProvider(context.extensionUri);
	// webviewprovider注册
	const CoSEFADispose = vscode.window.registerWebviewViewProvider(
		CoSEFAViewProvider.viewType,
		provider,
		{
			webviewOptions: {
				retainContextWhenHidden: true,
			},
		}
	);

	const completeCodeDispose = vscode.commands.registerTextEditorCommand(
		"CoSEFA.completeCode",
		(editor: vscode.TextEditor) => {
			const selected = editor.document.getText(editor.selection);
			console.log("completeCode");
			const d_message = selected;
			provider.msgType = "freeform";
			provider.message = d_message;
			provider.conversation();
		}
	);

	context.subscriptions.push(CoSEFADispose, completeCodeDispose);
}

class CoSEFAViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "CoSEFA.chatView";
	private _view?: vscode.WebviewView;

	private url: string = "http://localhost:7741/api/chat";

	public message: string = "";
	public msgType: ResponseType = "freeform";
	public langId: string = "";

	public pasteOnClick: boolean = true;

	constructor(private readonly _extensionUri: vscode.Uri) {}

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
			}
		});
	}

	public getPayload() {
		const editor = vscode.window.activeTextEditor!;
		if (!editor) {
			vscode.window.showWarningMessage("CoSEFA:对话前请先打开一个代码文件!");
			return false;
		}
		GlobalconversationHistory.push({ role: "user", content: this.message });
		const langType = editor.document.languageId;
		const data = {
			messages: GlobalconversationHistory,
			langid: LanguageMap[langType],
		};

		return data;
	}

	public async conversation() {
		const payload = this.getPayload();
		if (!payload) {
			return;
		}
		// console.log("payloadInfo", payload);

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
			const response = await axios.request({
				method: "POST",
				url: this.url,
				data: payload,
				responseType: "stream",
			});
			console.log(response.data);
			const stream = response.data;
			this.streamSource(stream);
		} catch (e: any) {
			console.error("Error fetching data:", e);
			return;
		}
	}

	private streamSource(stream: any) {
		let content = "";
		stream.on("data", (chunk: any) => {
			const lines = chunk.toString().trim().split("\n");
			console.log(lines);
			for (const line of lines) {
				if (line === "") {
					continue;
				}
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
			console.log("Stream ended.");
		});

		stream.on("error", (err: any) => {
			this._view?.webview.postMessage({
				type: "showInput",
				value: "出错啦，请重试...",
			});
			console.error("异常断开");
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

		return `<!DOCTYPE html>
				<html lang="en">
					<head>
						<meta charset="UTF-8" />
						<meta
							name="viewport"
							content="width=device-width, initial-scale=1.0"
						/>
						<title>AI Chat Interface</title>
						<script src="${tailwindScriptUri}"></script>
						<script src="${highlightScriptUri}"></script>
						<script src="${markedScriptUri}"></script>
						<link rel="stylesheet" href="${highlightStyleUri}">
						<link rel="stylesheet" href="${mainStyleUri}">
 
					</head>
					<body class="font-sans">
						<div class="flex h-screen antialiased">
							<div
								class="flex flex-col flex-auto h-full bg-[#282C34] overflow-hidden"
							>
								<div class="flex flex-col flex-auto flex-shrink-0 h-full p-4">
									<div
										id="chat-box"
										class="message-box flex flex-col h-full overflow-x-auto mb-4 bg-[#21252B] rounded-lg p-4"
									>
										<!-- Messages will be inserted here -->
									</div>

									<div class="flex flex-row items-center justify-center space-x-4 mb-4">
										<button
											id="stop-response"
											class="bg-[#E06C75] text-[#282C34] font-bold py-2 px-6 rounded-full hover:bg-[#E06C75]/80 transition duration-300 ease-in-out transform hover:scale-105 hidden"
										>
											停止接收
										</button>
										<button
											id="clear-msg"
											class="bg-[#D19A66] text-[#282C34] font-bold py-2 px-6 rounded-full hover:bg-[#D19A66]/80 transition duration-300 ease-in-out transform hover:scale-105"
										>
											清除会话
										</button>
									</div>

									<div
										id="bottom-box"
										class="flex flex-row items-center h-12 rounded-xl bg-[#282C34] w-full px-1 border-2 border-[#3E4451]"
									>
										<div class="flex-grow ml-2">
											<textarea
												id="prompt-input"
												class="w-full bg-[#282C34] text-[#ABB2BF] border-none resize-none rounded-xl pl-1 mt-2 h-6 transition-all duration-100 focus:outline-none focus:ring-2 focus:ring-[#61AFEF] "
												placeholder="输入您的消息..."
												rows="1"
											></textarea>
										</div>
										<div class="ml-4">
											<button
												id="send-btn"
												class="send-button flex items-center justify-center bg-[#98C379] hover:bg-[#98C379]/80 rounded-full text-[#282C34] px-3 py-2 flex-shrink-0 transition duration-300 ease-in-out transform hover:scale-110"
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

export function deactivate() {}
