from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import json
import re
import asyncio
import uvicorn

from CoSec.CoSecGenerator import CoSecGenerator
from LLMFix.LLMFixGenerator import LLMFixGenerator

app = FastAPI()

cosec = CoSecGenerator()
llmfix = LLMFixGenerator()


# 模拟一个简单的对话生成函数
async def generate_response(messages, langid):
    input_str = messages[-1]["content"]
    print(input_str)
    code = cosec.generate(input_str, langid)
    pattern = r"<｜.*?｜>"
    cleaned_code = re.sub(pattern, "", code)
    llmfix.get_code(code=cleaned_code)
    fixed_code, judge, e = llmfix.exec_fix()
    response = "```{}\n{}\n```".format(langid, fixed_code)
    print(response)
    return response


@app.post("/api/chat")
async def chat(request: Request):
    # 解析请求体
    body = await request.json()
    messages = body.get("messages", [])
    langid = body.get("langid")
    print(langid)

    # 定义一个异步生成器函数来模拟流式响应
    async def response_generator():
        response = await generate_response(messages, langid)
        chunk_size = 5  # 每个chunk的长度，可以根据需要调整

        for i in range(0, len(response), chunk_size):
            chunk = response[i : i + chunk_size]
            yield f"data: {json.dumps({'message':{'content': chunk}})}\n\n"
            await asyncio.sleep(0.05)  # 模拟延迟，可以根据需要调整

    # 返回流式响应
    return StreamingResponse(response_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7741)
