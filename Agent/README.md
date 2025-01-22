# Programming Assistant Plugin

The `Agent` directory contains the code files for the VSCode programming assistant plugin.

### Installation

Users can follow these steps to install:

```sh
# 1. Enter the Agent directory
code Agent
# 2. Install project dependencies
npm install
# 3. Start the project
Open the `extension.ts` file and press F5 to start debugging the programming assistant. If a debugger selection dropdown appears, choose the "VS Code Extension Development" debugger.
```

### Description

Some features are still in progress and involve some innovative implementations.

### Precompiled Version

We provide a precompiled version that can be downloaded from the following link: [Baidu Netdisk](https://pan.baidu.com/s/15b3SlWusTzr9twnM5Qqq3w?pwd=sc4x) with the extraction code: `sc4x`.

### Packaging

If needed, you can package the project using the following steps:

1. Install the `vsce` tool:
    ```sh
    npm i vsce -g
    ```
2. Package the project into a `.vsix` file:
    ```sh
    vsce package
    ```
