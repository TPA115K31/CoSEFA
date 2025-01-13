import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, set_seed

from .Evaler import CO_Evaler


class predefined_parser:
    def __init__(self) -> None:
        self.model_name_or_path = "CoSec/model/deepseek-coder-6.7b"
        self.base_model = "CoSec/model/deepseek-coder-1.3b"
        self.sec_model = "CoSec/model/checkpoint-last"
        self.temp = 0.4
        self.top_p = 0.95
        self.max_gen_len = 256
        self.num_samples_per_gen = 1
        self.exp_temp = 0.4
        self.threshold = 0.3
        self.seed = 3407


class CoSecGenerator:
    def __init__(self, request_args = None) -> None:
        self.args = request_args if request_args is not None else predefined_parser()
        self.args.n_gpu = torch.cuda.device_count()
        self.args.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        set_seed(42)
        self.evaler = CO_Evaler(self.args)

    def generate(self, prompt, langid):
        # if self.evaler.model_loading:
        #     return {"status": "loading model"}
        print(langid)
        output_srcs, output_ids, dup_srcs, non_parsed_srcs = self.evaler.sample(
            prompt, "", ["orig"], langid
        )
        return output_srcs[0]
