import re

from peft import PeftModel
from transformers import AutoTokenizer, CodeGenForCausalLM, AutoModelForCausalLM

from .CustomizedGeneration import (
    CodegenModelLM,
    IncoderModelLM,
    StarcodeModelLM,
    CodeLlamaModelLM,
)

# from scripts.co_generation import CodegenModelLM
from .utils import load_model, try_parse


class LM_Evaler:

    def __init__(self, args):
        self.args = args
        self.load_model()

    def load_model(self):
        self.tokenizer, self.model, self.input_device = load_model(
            "lora" if self.args.model_type == "lora" else "lm",
            self.args.model_name_or_path,
            False,
            self.args,
        )
        self.model.eval()

    def truncate(self, completion, lang):
        if lang == "py":
            for match in re.finditer("\n", completion):
                cur_idx, next_idx = match.start(), match.end()
                if next_idx < len(completion) and not completion[next_idx].isspace():
                    completion = completion[:cur_idx]
                    break
            else:
                last_comment_str = "\n    #"
                if last_comment_str in completion:
                    completion = completion[: completion.rfind(last_comment_str)]
        elif lang == "c":
            if "\n}" in completion:
                completion = completion[: completion.find("\n}") + 2]
            else:
                last_comment_strs = ["\n    //", "\n    /*"]
                for last_comment_str in last_comment_strs:
                    if last_comment_str in completion:
                        completion = completion[: completion.rfind(last_comment_str)]
                        completion = completion.rstrip() + "\n}"

            lines = completion.split("\n")
            final_lines = []
            for line in lines:
                if '->name = "' in line:
                    continue
                final_lines.append(line)
            completion = "\n".join(final_lines)
        else:
            raise NotImplementedError()

        return completion

    def process_completions(self, input_src, input_ids_len, gen_output, lang):

        tokens = gen_output[:, input_ids_len:, ...]
        completions = self.tokenizer.batch_decode(tokens)

        output_srcs, output_ids = [], []
        dup_srcs, non_parsed_srcs = [], []
        for i, completion in enumerate(completions):
            # 如果eos在文中，就在eos处停止
            if self.tokenizer.eos_token in completion:
                completion = completion[: completion.find(self.tokenizer.eos_token)]

            completion = self.truncate(completion, lang)
            completion_len = len(self.tokenizer.encode(completion))

            output_src = input_src + completion
            output_src = output_src.rstrip() + "\n"

            if output_src in output_srcs:
                dup_srcs.append(output_src)
            elif try_parse(output_src, lang) != 0:
                non_parsed_srcs.append(output_src)
            else:
                output_srcs.append(output_src)
                output_ids.append(
                    (
                        gen_output[i][:input_ids_len].tolist(),
                        gen_output[i][
                            input_ids_len : input_ids_len + completion_len
                        ].tolist(),
                    )
                )

        return output_srcs, output_ids, dup_srcs, non_parsed_srcs

    def sample(self, file_context, func_context, control, lang):
        # input_src: 完整的python或者c/c++文件，从import 到函数定义
        input_src = file_context + func_context
        input_ids = self.tokenizer(input_src, return_tensors="pt").input_ids.to(
            self.input_device
        )
        input_ids_len = input_ids.shape[1]
        gen_output = self.model.generate(
            input_ids=input_ids,
            do_sample=True,
            num_return_sequences=self.args.num_gen,
            temperature=self.args.temp,
            max_new_tokens=self.args.max_gen_len,
            top_p=self.args.top_p,
            pad_token_id=self.tokenizer.pad_token_id,
            use_cache=True,
            # return_dict_in_generate=True,
            # output_scores=True,
        )

        return self.process_completions(input_src, input_ids_len, gen_output, lang)


class CO_Evaler:

    def __init__(self, args):
        self.args = args
        # Record the current loaded model path
        self.current_model_path = None
        self.current_base_model = None
        self.current_sec_model = None
        # Add a flag for model loading status
        self.model_loading = False
        self.load_model()

    def update_args(self, new_args):
        """Update args parameters and check if the model needs to be reloaded"""
        # Check if the model path has changed
        model_changed = (
            new_args.model_name_or_path != self.current_model_path or
            new_args.base_model != self.current_base_model or
            new_args.sec_model != self.current_sec_model
        )
        
        # Update all parameters
        self.args.temp = new_args.temp
        self.args.top_p = new_args.top_p
        self.args.max_gen_len = new_args.max_gen_len
        self.args.num_samples_per_gen = new_args.num_samples_per_gen
        self.args.exp_temp = new_args.exp_temp
        self.args.threshold = new_args.threshold
        self.args.seed = new_args.seed
        self.args.model_name_or_path = new_args.model_name_or_path
        self.args.base_model = new_args.base_model
        self.args.sec_model = new_args.sec_model

        # Reload the model if the model path has changed
        if model_changed:
            self.model_loading = True  # flag to indicate that the model is loading
            self.load_model()
            self.model_loading = False  # flag to indicate that the model has finished loading
    
    def load_model(self):
        # Load the model based on the model name
        if "deepseek" in self.args.model_name_or_path:
            self.model = CodeLlamaModelLM.from_pretrained(
                self.args.model_name_or_path,
                device_map="auto",
            )
            base_model = AutoModelForCausalLM.from_pretrained(
                self.args.base_model,
                device_map="auto",
            )
            self.sec_model = PeftModel.from_pretrained(base_model, self.args.sec_model)
        elif "incoder" in self.args.model_name_or_path:
            self.model = IncoderModelLM.from_pretrained(
                self.args.model_name_or_path,
                device_map="auto",
            )
            base_model = AutoModelForCausalLM.from_pretrained(
                self.args.base_model,
                device_map="auto",
            )
            self.sec_model = PeftModel.from_pretrained(base_model, self.args.sec_model)
        elif "star" in self.args.model_name_or_path:
            self.model = StarcodeModelLM.from_pretrained(
                self.args.model_name_or_path,
                device_map="auto",
            )
            base_model = AutoModelForCausalLM.from_pretrained(
                self.args.base_model,
                device_map="auto",
            )
            self.sec_model = PeftModel.from_pretrained(base_model, self.args.sec_model)
        elif "codegen" in self.args.model_name_or_path:
            self.model = CodegenModelLM.from_pretrained(
                self.args.model_name_or_path,
                device_map="auto",
            )
            base_model = CodeGenForCausalLM.from_pretrained(
                self.args.base_model,
                device_map="auto",
            )
            base_model.resize_token_embeddings(len(self.tokenizer))
            self.sec_model = PeftModel.from_pretrained(base_model, self.args.sec_model)
        else:
            raise NotImplementedError()

        # Load the tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(self.args.model_name_or_path)

        # Set the tokenizer parameters
        if self.tokenizer.eos_token_id is None:
            self.tokenizer.eos_token_id = self.tokenizer.bos_token_id
        if self.tokenizer.pad_token_id is None:
            self.tokenizer.pad_token_id = self.tokenizer.eos_token_id

        # Resize the token embeddings
        self.model.resize_token_embeddings(len(self.tokenizer))

        # Set the model to evaluation mode
        self.model.eval()

        # Set the secondary model to evaluation mode
        self.sec_model.eval()
        
        # Record the current loaded model path
        self.current_model_path = self.args.model_name_or_path
        self.current_base_model = self.args.base_model
        self.current_sec_model = self.args.sec_model
        self.model_loading = False  # 确保模型加载完成后更新标志位

    def truncate(self, completion, lang):
        """
        Truncates the given completion string based on the specified programming language.
        Args:
            completion (str): The completion string to be truncated.
            lang (str): The programming language of the completion string. Supported values are "py" for Python and "c" for C.
        Returns:
            str: The truncated completion string.
        Raises:
            NotImplementedError: If the specified language is not supported.
        """
        if lang == "py":
            for match in re.finditer("\n", completion):
                cur_idx, next_idx = match.start(), match.end()
                if next_idx < len(completion) and not completion[next_idx].isspace():
                    completion = completion[:cur_idx]
                    break
            else:
                last_comment_str = "\n    #"
                if last_comment_str in completion:
                    completion = completion[: completion.rfind(last_comment_str)]
        elif lang == "c":
            if "\n}" in completion:
                completion = completion[: completion.find("\n}") + 2]
            else:
                last_comment_strs = ["\n    //", "\n    /*"]
                for last_comment_str in last_comment_strs:
                    if last_comment_str in completion:
                        completion = completion[: completion.rfind(last_comment_str)]
                        completion = completion.rstrip() + "\n}"

            lines = completion.split("\n")
            final_lines = []
            for line in lines:
                if '->name = "' in line:
                    continue
                final_lines.append(line)
            completion = "\n".join(final_lines)
        else:
            raise NotImplementedError()

        return completion

    def process_completions(self, input_src, input_ids_len, gen_output, lang):

        tokens = gen_output[:, input_ids_len:, ...]
        completions = self.tokenizer.batch_decode(tokens)
        output_srcs, output_ids = [], []
        dup_srcs, non_parsed_srcs = [], []
        for i, completion in enumerate(completions):
            # If eos is in the text, stop at eos
            if self.tokenizer.eos_token in completion:
                completion = completion[: completion.find(self.tokenizer.eos_token)]

            completion = self.truncate(completion, lang)
            completion_len = len(self.tokenizer.encode(completion))

            output_src = input_src + completion
            output_src = output_src.rstrip() + "\n"
            if output_src in output_srcs:
                dup_srcs.append(output_src)
            elif try_parse(output_src, lang) != 0:
                non_parsed_srcs.append(output_src)
            else:
                output_srcs.append(output_src)
                output_ids.append(
                    (
                        gen_output[i][:input_ids_len].tolist(),
                        gen_output[i][
                            input_ids_len : input_ids_len + completion_len
                        ].tolist(),
                    )
                )

        return output_srcs, output_ids, dup_srcs, non_parsed_srcs

    def sample(self, file_context, func_context, control, lang):
        # input_src: Complete Python or C/C++ file, from import to function definition
        input_src = file_context + func_context
        input_ids = self.tokenizer(input_src, return_tensors="pt").input_ids.to(
            self.args.device
        )
        input_ids_len = input_ids.shape[1]
        kwargs = {
            "expert": True,
            "expert_lm": self.sec_model,
            "model_kwargs_expert": {},
            "threshold": self.args.threshold,
        }
        gen_output = self.model.generate_with_experts(
            input_ids=input_ids,
            do_sample=True,
            num_return_sequences=self.args.num_samples_per_gen,
            temperature=self.args.temp,
            max_new_tokens=self.args.max_gen_len,
            top_p=self.args.top_p,
            pad_token_id=self.tokenizer.pad_token_id,
            use_cache=True,
            expert_min_prob=0.0,
            expert_temperature=self.args.exp_temp,
            expert_top_p=0.95,
            **kwargs
        )
        # print(self.tokenizer.decode(gen_output[0]))
        return self.process_completions(input_src, input_ids_len, gen_output, lang)
