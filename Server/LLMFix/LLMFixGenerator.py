from LLMFix.postprocessing import *
from LLMFix.importprocessing import test_function


class LLMFixGenerator:
    def __init__(self):
        self.code = ""

    def get_code(self, code):
        self.code = code

    def exec_fix(self):
        code = filter(self.code, GPT=False)
        judge = False
        while not judge:
            try:
                compile(source=code, filename="", mode="exec")
                judge = True
            except Exception as e:
                print_test_result(judge, e)
                code = remove_last_row(code)
                judge = False
        judge, exception = test_function(code)
        print_test_result(judge, exception)

        return code, judge, exception
