import * as vscode from "vscode";
import { registerCommands } from "./commandManager";
import { initializeGlobals, finishGlobals } from "./globals";

// 激活插件
export function activate(context: vscode.ExtensionContext) {
	console.log('Extension "CoSEFA" is now active!');

	// 初始化全局变量
	initializeGlobals(context);

	// 命令注册
	registerCommands(context);
}

export function deactivate() {
	console.log('Extension "CoSEFA" is now shutdown!');
	finishGlobals();
}
