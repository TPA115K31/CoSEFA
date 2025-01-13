import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class ConversationManager {
	private currentConversationId: number = 0;
	private currentConversationLabel: string = "";
	private conversationHistory: {
		id: number;
		label: string;
		messages: any[];
	}[] = [];
	private currentConversation: any[] = [];
	private dataFilePath: string;

	constructor() {
		const homeDir = os.homedir();
		const dataDir = path.join(homeDir, '.CoSEFA');
		this.dataFilePath = path.join(dataDir, 'conversationHistory.json');

		if (!fs.existsSync(dataDir)) {
			fs.mkdirSync(dataDir);
		}

		if (fs.existsSync(this.dataFilePath)) {
			const data = fs.readFileSync(this.dataFilePath, 'utf-8');
			this.conversationHistory = JSON.parse(data);
			// 找到现有会话的最大ID
			const maxId = this.conversationHistory.reduce((max, conv) =>
				conv.id > max ? conv.id : max
			, -1);
			// 将currentConversationId设置为最大ID加1
			this.currentConversationId = maxId + 1;
		} else {
			this.conversationHistory = [];
			this.currentConversationId = 0;
		}
	}

	public getCurrentConversationId() {
		return this.currentConversationId;
	}

	public getCurrentConversation() {
		return this.currentConversation;
	}

	public getCurrentConversationLabel() {
		return this.currentConversationLabel;
	}

	public setCurrentConversationLabel(label: string) {
		this.currentConversationLabel = label;
	}

	public saveCurrentConversation() {
		if (this.currentConversation.length > 0) {
			const existingConversation = this.conversationHistory.find(
				(conv) => conv.id === this.currentConversationId
			);
			if (existingConversation) {
				existingConversation.messages = [...this.currentConversation];
			} else {
				this.conversationHistory.push({
					id: this.currentConversationId,
					label: this.currentConversationLabel,
					messages: [...this.currentConversation],
				});
			}
			console.log(this.conversationHistory);
		}
		// fs.writeFileSync(this.dataFilePath, JSON.stringify(this.conversationHistory, null, 2));
	}

	public loadConversation(conversationId: number) {
		const conversation = this.conversationHistory.find(
			(conv) => conv.id === conversationId
		);
		if (conversation) {
			this.currentConversation = [...conversation.messages];
			this.currentConversationId = conversation.id;
			this.currentConversationLabel = conversation.label;
		}
	}

	public startNewConversation() {
		this.currentConversation = [];
		// 找到现有会话的最大ID
		const maxId = this.conversationHistory.reduce((max, conv) =>
			conv.id > max ? conv.id : max
		, -1);
		// 将currentConversationId设置为最大ID加1
		this.currentConversationId = maxId + 1;
		this.currentConversationLabel = "";
	}

	public renameConversation(conversationId: number, newName: string) {
		const conversation = this.conversationHistory.find(
			(conv) => conv.id === conversationId
		);
		if (conversation) {
			conversation.label = newName;
		}
	}

	public deleteConversation(conversationId: number) {
		this.conversationHistory = this.conversationHistory.filter(
			(conv) => conv.id !== conversationId
		);
		// fs.writeFileSync(this.dataFilePath, JSON.stringify(this.conversationHistory, null, 2));
	}

	public getConversationHistoryItems() {
		return this.conversationHistory.map((conv) => ({
			label: conv.label,
			id: conv.id,
		}));
	}

	public addMessage(role: "user" | "assistant", content: string) {
		this.currentConversation.push({ role, content });
	}

	public clearCurrentConversation() {
		this.currentConversation = [];
		this.currentConversationLabel = "";
	}

	// 添加获取 conversationHistory 的方法
	public getConversationHistory() {
		return this.conversationHistory;
	}

	// 添加获取 dataFilePath 的方法
	public getDataFilePath() {
		return this.dataFilePath;
	}
}
