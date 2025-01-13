// @ts-nocheck
(function () {
	const vscode = acquireVsCodeApi();

	marked.setOptions({
		renderer: new marked.Renderer(),
		gfm: true,
		tables: true,
		breaks: false,
		pedantic: false,
		sanitize: false,
		smartLists: true,
		smartypants: false,
		highlight: function (code, lang) {
			//使用 highlight 插件解析文档中代码部分
			return hljs.highlightAuto(code, [lang]).value;
		},
	});

	let receiveData = {
		msgType: "freeform",
		fileName: "js",
	};

	window.addEventListener("message", (event) => {
		const message = event.data;
		switch (message.type) {
			case "addQuestion": {
				receiveData = message;
				addQuestion(message.value);
				break;
			}
			case "addAnswer": {
				addAnswer(message.value);
				break;
			}
			case "showInput": {
				showInput(true, message.value);
				break;
			}
			case "clearChat": {
				document.getElementById("chat-box").innerHTML = "";
				showInput(true);
				break;
			}
			case "loadConversation": {
				const messages = message.messages;
				document.getElementById("chat-box").innerHTML = "";
				messages.forEach(msg => {
					if (msg.role === 'user') {
						addQuestion(msg.content);
					} else if (msg.role === 'assistant') {
						addAnswer(msg.content);
					}
				});
				showInput(true, null);
				break;
			}
		}
	});

	function scrollToBottom() {
		const chatBox = document.getElementById("chat-box");
		chatBox.scrollTop = chatBox.scrollHeight;
	}

	function showInput(type, msg) {
		let box = document.getElementById("bottom-box");
		let input = document.getElementById("prompt-input");
		if (type) {
			if (msg) {
				let ele_div = document.querySelector(".chat-answer:last-child");
				ele_div.innerText = msg;
			}
			box.style.pointerEvents = "all";
			stopBtn.style.display = "none";
		} else {
			box.style.pointerEvents = "none";
			input.value = "";
			input.blur();
			stopBtn.style.display = "block";
		}
	}

	function createElement(className, additionalClasses) {
		let ele_div = document.createElement("div");
		ele_div.className = className + " " + additionalClasses;
		document.getElementById("chat-box").appendChild(ele_div);
		return ele_div;
	}

	function addQuestion(message) {
		showInput(false);
		let ele_div = createElement(
			"chat-question",
			"mt-2.5 mb-2.5 pl-2.5 pr-2.5 pt-2.5 pb-2.5 border-l-4 border-cyan-600 text-gray-300"
		);
		ele_div.innerText = message;
		let ele_div_answer = createElement(
			"chat-answer",
			"p-2.5 bg-[#282C34] text-gray-100"
		);
		ele_div_answer.innerText = "Thinking...";
		scrollToBottom();
	}

	function addAnswer(content) {
		// 如果是停止响应，不再添加内容
		if (stopBtn.style.display === "none") {
			return;
		}

		if (receiveData.msgType !== "freeform") {
			const fileSplit = receiveData.fileName.split(".");
			const lang = fileSplit[fileSplit.length - 1];
			content = "```" + lang + "\n" + content + "\n```";
		}

		html = marked.parse(content);
		ele_div = document.querySelector(".chat-answer:last-child");
		ele_div.innerHTML = html;

		preBlocks = ele_div.querySelectorAll("pre");

		preBlocks.forEach((preTag) => {
			preTag.insertAdjacentHTML(
				"afterbegin",
				`<div class="flex justify-end p-1 pr-1.5 gap-2.5 bg-[color:var(--vscode-editorWidget-background)]">
					<a href="javascript:;" class="copy-btn text-xs text-[color:var(--vscode-textLink-foreground)] font-[var(--vscode-font-family)] font-[var(--vscode-font-weight)] hover:text-[color:var(--vscode-textLink-activeForeground)] active:border-none focus:border-none">Copy Code</a>
					<a href="javascript:;" class="insert-btn text-xs text-[color:var(--vscode-textLink-foreground)] font-[var(--vscode-font-family)] font-[var(--vscode-font-weight)] hover:text-[color:var(--vscode-textLink-activeForeground)] active:border-none focus:border-none">Insert Code</a>
					<a href="javascript:;" class="save-btn text-xs text-[color:var(--vscode-textLink-foreground)] font-[var(--vscode-font-family)] font-[var(--vscode-font-weight)] hover:text-[color:var(--vscode-textLink-activeForeground)] active:border-none focus:border-none">Save to New File</a>
				</div>`
			);
			let copyBtn = preTag.querySelector(".copy-btn");
			let insertBtn = preTag.querySelector(".insert-btn");
			let saveBtn = preTag.querySelector(".save-btn");
			let codeText = preTag.querySelector("code").innerText;
			copyBtn.addEventListener("click", function (e) {
				e.preventDefault();
				navigator.clipboard.writeText(codeText);
			});
			insertBtn.addEventListener("click", function (e) {
				e.preventDefault();
				vscode.postMessage({
					type: "codeSelected",
					value: codeText,
				});
			});
			saveBtn.addEventListener("click", function (e) {
				e.preventDefault();
				vscode.postMessage({
					type: "saveToFile",
					value: codeText,
				});
			});
		});

		scrollToBottom();
	}

	document
		.getElementById("prompt-input")
		.addEventListener("keydown", function (e) {
			// If the key that was pressed was the Enter key
			if (e.key === "Enter" && !e.shiftKey) {
				vscode.postMessage({
					type: "prompt",
					value: this.value,
				});
				setTimeout(adjustTextareaHeight, 0);
			}
		});

	const sendBtn = document.getElementById("send-btn");
	sendBtn.addEventListener("click", function (e) {
		promptValue = document.getElementById("prompt-input").value
		vscode.postMessage({
			type: "prompt",
			value: promptValue
		});
		setTimeout(adjustTextareaHeight, 0);
	});

	const stopBtn = document.getElementById("stop-response");
	stopBtn.addEventListener("click", function (e) {
		showInput(true, "Response ended, please start a new conversation...");
	});

	// 自动调整textarea高度的脚本
	const textarea = document.getElementById("prompt-input");
	textarea.addEventListener("input", ()=>{
		textarea.style.height = "auto";
		textarea.style.height = textarea.scrollHeight + "px";
	});

})();
