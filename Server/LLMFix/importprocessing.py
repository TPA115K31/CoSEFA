import ast
import random
import string


def analyze_function(code):
    tree = ast.parse(code)
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            return node.name, [arg.arg for arg in node.args.args]


def generate_safe_input(param_name):
    if "str" in param_name.lower():
        return "".join(random.choice(string.ascii_letters) for _ in range(10))
    elif "list" in param_name.lower() or "data" in param_name.lower():
        return [random.randint(1, 100) for _ in range(5)]
    else:
        return random.randint(1, 100)


def test_function(code):
    func_name, params = analyze_function(code)
    namespace = {}
    try:
        exec(code, namespace)
    except Exception as e:
        return False, e
    func = namespace[func_name]
    try:
        args = [generate_safe_input(param) for param in params]
        result = func(*args)
        print(f"Success: {func_name}({args}) = {result}")
        return True, None
    except Exception as e:
        return False, e
