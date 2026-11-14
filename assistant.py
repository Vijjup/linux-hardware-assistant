import json
import sys
from main import route_and_answer_with_ai


def run_cli_diagnostic(user_query: str):
    print(f"\nQuery: {user_query}")
    try:
        tool_name, summary, telemetry = route_and_answer_with_ai(user_query)
        print(f"Tool Executed: {tool_name}")
        print(f"Summary: {summary}")
        print(json.dumps(telemetry, indent=2))
    except Exception as exc:
        print(f"Blocked / Error: {getattr(exc, 'detail', str(exc))}")


if __name__ == "__main__":
    sample_query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "How much free RAM is available?"
    run_cli_diagnostic(sample_query)