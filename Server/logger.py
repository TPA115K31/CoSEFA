import os
import json


class Logger:
    def __init__(self, log_dir="logs"):
        self.log_dir = log_dir
        os.makedirs(log_dir, exist_ok=True)

    def log(self, ip, timestamp, messages, response_content:str):
        # 将流式输出结果转换为正常结果
        response_lines = response_content.strip().split("\n")
        response_data = [json.loads(line) for line in response_lines]
        response_messages = [
            data["message"]["content"] for data in response_data if "message" in data
        ]

        log_data = {
            "ip": ip,
            "timestamp": timestamp,
            "messages": messages,
            "response_content": "".join(response_messages),
        }
        log_file = os.path.join(self.log_dir, f"{ip}.log")
        with open(log_file, "a") as f:
            f.write(json.dumps(log_data, ensure_ascii=False) + "\n")
