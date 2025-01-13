from fastapi import FastAPI
from routers import chatgpt

app = FastAPI()
app.include_router(chatgpt.router)