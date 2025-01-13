from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from CoSec.CoSecGenerator import CoSecGenerator
from LLMFix.LLMFixGenerator import LLMFixGenerator
import time
import re

router = APIRouter()

cosec = CoSecGenerator()

llmfix = LLMFixGenerator()

# Model configuration mapping
MODEL_CONFIGS = {
    "deepseekcoder": {
        "model_name_or_path": "CoSec/model/deepseek-coder-6.7b",
        "base_model": "CoSec/model/deepseek-coder-1.3b",
        "sec_model": "CoSec/model/checkpoint-last",
    },
    "starcoder": {
        "model_name_or_path": "CoSec/model/starcoder",
        "base_model": "CoSec/model/starcoder-base",
        "sec_model": "CoSec/model/starcoder-checkpoint",
    },
    # More model configurations can be added
}

# Default model configuration
DEFAULT_MODEL_CONFIG = {
    "model_name_or_path": "CoSec/model/deepseek-coder-6.7b",
    "base_model": "CoSec/model/deepseek-coder-1.3b",
    "sec_model": "CoSec/model/checkpoint-last",
}


# Request argument parser
class RequestArgsParser:
    def __init__(self, request: "ChatCompletionRequest") -> None:
        """
        Initializes the chat completion request handler with the given request parameters.

        Args:
            request (ChatCompletionRequest): The request object containing parameters for chat completion.

        Attributes:
            model_name_or_path (str): The path or name of the model to be used.
            base_model (str): The base model configuration.
            sec_model (str): The secondary model configuration.
            temp (float): The temperature parameter for the model.
            top_p (float): The top-p sampling parameter.
            max_gen_len (int): The maximum length of generated tokens.
            num_samples_per_gen (int): The number of samples to generate per request.
            exp_temp (float): The experimental temperature parameter.
            threshold (float): The threshold value for some internal logic.
            seed (int): The seed value for random number generation.
        """

        # Select model configuration based on the model field
        model_config = MODEL_CONFIGS.get(request.model.lower(), DEFAULT_MODEL_CONFIG)

        # Set model paths
        self.model_name_or_path = model_config["model_name_or_path"]
        self.base_model = model_config["base_model"]
        self.sec_model = model_config["sec_model"]

        # Get other parameters from the request
        self.temp = request.temperature
        self.top_p = request.top_p
        self.max_gen_len = request.max_tokens if request.max_tokens else 256
        self.num_samples_per_gen = request.n
        self.exp_temp = request.temperature
        self.threshold = 0.3
        self.seed = request.seed


# Request model
class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: str
    messages: List[ChatMessage]
    max_tokens: Optional[int] = None
    n: Optional[int] = 1
    seed: Optional[float] = 3407
    temperature: Optional[float] = 0.4
    top_p: Optional[float] = 0.95
    langid: Optional[str] = "py"
    stream: Optional[bool] = False


# Response model
class ChatCompletionChoice(BaseModel):
    index: int
    message: ChatMessage
    finish_reason: str


class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[ChatCompletionChoice]


@router.post("/v1/chat/completions", response_model=ChatCompletionResponse)
async def create_chat_completion(request: ChatCompletionRequest):
    try:
        # Create argument parser
        request_args = RequestArgsParser(request)
        cosec.evaler.update_args(request_args)

        # Get the last message as the prompt
        prompt = request.messages[-1].content if request.messages else ""

        # Generate response
        secure_hardened_completion = cosec.generate(prompt, request.langid)
        cleaned_code = re.sub(r"<｜.*?｜>", "", secure_hardened_completion)
        response = "```{}\n{}\n```".format(request.langid, cleaned_code)

        # if model is still loading, return loading status
        # if isinstance(generated_text, dict) and generated_text.get("status") == "loading model":
        #     return {"status": "loading model"}

        response = ChatCompletionResponse(
            id=f"chatcmpl-{int(time.time())}",
            created=int(time.time()),
            model=request.model,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=ChatMessage(role="assistant", content=response),
                    finish_reason="stop",
                )
            ],
        )

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
