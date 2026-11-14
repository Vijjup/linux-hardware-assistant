import subprocess
import json
import shutil
import platform

# 1. ALLOW-LISTED TOOLS (Security: Prevents arbitrary shell execution)
ALLOW_LISTED_TOOLS = {
    "get_cpu_info": ["lscpu"],
    "get_block_devices": ["lsblk", "-J", "-o", "NAME,SIZE,TYPE,MOUNTPOINT"],
    "get_memory_summary": ["free", "-b"]
}

def execute_system_tool(tool_name: str) -> dict:
    """Safely runs allow-listed tools with OS compatibility checks."""
    if tool_name not in ALLOW_LISTED_TOOLS:
        return {"error": f"Unauthorized tool: {tool_name}"}
    
    cmd = ALLOW_LISTED_TOOLS[tool_name]
    binary = cmd[0]
    
    # Check if the Linux binary exists on the current OS
    if not shutil.which(binary):
        if platform.system() == "Windows":
            if tool_name == "get_memory_summary":
                return {
                    "platform_notice": "Running on Windows (Linux tools not native). Returning simulated hardware specs.",
                    "total": 16106127360, 
                    "used": 8589934592, 
                    "free": 7516192768
                }
        return {"error": f"Required system utility '{binary}' not found on this machine."}

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
            timeout=5
        )
        return {"output": result.stdout.strip()}
    except Exception as e:
        return {"error": str(e)}

def ask_hardware_assistant(user_query: str):
    print(f"\nUser: {user_query}")
    query_lower = user_query.lower()
    
    # Intent mapping (Safe tool dispatch without model version errors)
    if "ram" in query_lower or "memory" in query_lower:
        tool_name = "get_memory_summary"
    elif "cpu" in query_lower or "processor" in query_lower:
        tool_name = "get_cpu_info"
    elif "disk" in query_lower or "storage" in query_lower:
        tool_name = "get_block_devices"
    else:
        print("Assistant: I can only answer questions related to CPU, RAM, and Storage.")
        return

    print(f"[System] Executing allowed tool: {tool_name}")
    tool_result = execute_system_tool(tool_name)
    
    # Print formatted output
    print("Assistant Response:")
    print(json.dumps(tool_result, indent=2))

if __name__ == "__main__":
    print("=== Linux Hardware Q&A Assistant Ready ===")
    ask_hardware_assistant("How much RAM do I have?")