from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import shutil
import platform
import os
import json
from google import genai
from google.genai import types

app = FastAPI(title="AI-Powered Linux Hardware & SysAdmin Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    query: str

# 8 Allow-Listed Read-Only System Tools (Data-driven registry: zero if-else routing!)
TOOL_REGISTRY = {
    "get_memory_summary": {
        "cmd": ["free", "-b"],
        "keywords": ["ram", "memory", "swap"],
        "description": "Get total, used, and free RAM memory statistics.",
        "simulated": {
            "total": 16106127360,
            "used": 8589934592,
            "free": 7516192768
        }
    },
    "get_cpu_info": {
        "cmd": ["lscpu"],
        "keywords": ["cpu", "processor", "core", "cores", "architecture", "thread"],
        "description": "Get CPU processor model, architecture, and core count.",
        "simulated": {
            "architecture": "x86_64",
            "cpu_cores": 8,
            "model_name": "Intel Core i7-11700H"
        }
    },
    "get_block_devices": {
        "cmd": ["lsblk", "-J", "-o", "NAME,SIZE,TYPE,MOUNTPOINT"],
        "keywords": ["disk", "storage", "hard", "drive", "mount", "mounted", "partition", "ssd", "nvme"],
        "description": "Get disk storage devices, sizes, types (SSD/HDD), and mountpoints.",
        "simulated": {
            "devices": [
                {"name": "nvme0n1p1", "size": "512GB", "type": "SSD", "mountpoint": "/"},
                {"name": "sda1", "size": "1TB", "type": "HDD", "mountpoint": "/mnt/data"}
            ]
        }
    },
    "get_system_uptime": {
        "cmd": ["uptime", "-p"],
        "keywords": ["uptime", "how long", "load", "boot", "up time", "been up"],
        "description": "Get system uptime duration and CPU load averages.",
        "simulated": {
            "uptime": "4 days, 6 hours, 22 minutes",
            "load_average": "0.42, 0.38, 0.31"
        }
    },
    "get_os_kernel": {
        "cmd": ["uname", "-a"],
        "keywords": ["kernel", "os", "ubuntu", "linux", "version", "hostname", "distro"],
        "description": "Get Linux OS distribution, kernel version, and system hostname.",
        "simulated": {
            "os_name": "Ubuntu 22.04.4 LTS",
            "kernel": "6.5.0-44-generic",
            "hostname": "linux-prod-node01"
        }
    },
    "get_network_interfaces": {
        "cmd": ["ip", "-br", "a"],
        "keywords": ["ip", "ipv4", "network", "interface", "wifi", "ethernet", "eth0"],
        "description": "Get network interfaces (eth0, lo), IP addresses, and link status.",
        "simulated": {
            "interfaces": [
                {"name": "eth0", "status": "UP", "ip": "192.168.1.105/24"},
                {"name": "lo", "status": "UNKNOWN", "ip": "127.0.0.1/8"}
            ]
        }
    },
    "get_top_processes": {
        "cmd": ["ps", "-eo", "pid,comm,%cpu,%mem", "--sort=-%mem"],
        "keywords": ["slow", "lag", "lagging", "process", "processes", "eating", "consuming", "top", "heavy"],
        "description": "Get top resource-consuming processes by CPU and RAM usage (for lag, slowness, high memory).",
        "simulated": {
            "top_processes": [
                {"pid": 1420, "command": "python3", "cpu_pct": 12.4, "mem_pct": 18.2},
                {"pid": 982, "command": "node", "cpu_pct": 6.1, "mem_pct": 11.5},
                {"pid": 510, "command": "postgres", "cpu_pct": 3.2, "mem_pct": 8.9}
            ]
        }
    },
    "get_open_ports": {
        "cmd": ["ss", "-tuln"],
        "keywords": ["port", "ports", "listening", "ssh", "open", "socket", "service"],
        "description": "Get active listening TCP/UDP network ports and running services.",
        "simulated": {
            "listening_ports": [
                {"protocol": "TCP", "port": 22, "service": "SSH"},
                {"protocol": "TCP", "port": 8000, "service": "FastAPI"},
                {"protocol": "TCP", "port": 5173, "service": "Vite-React"}
            ]
        }
    }
}

UNSAFE_KEYWORDS = ["delete", "rm ", "remove", "kill", "shutdown", "reboot", "format", "drop", "modify", "write"]

def execute_tool(tool_name: str) -> dict:
    if tool_name not in TOOL_REGISTRY:
        return {"error": f"Unauthorized tool: {tool_name}"}

    entry = TOOL_REGISTRY[tool_name]
    cmd = entry["cmd"]

    if not shutil.which(cmd[0]):
        if platform.system() == "Windows":
            return {"platform_notice": "Windows Host (Simulated Linux Telemetry)", **entry["simulated"]}
        return {"error": f"Utility '{cmd[0]}' not installed."}

    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=5)
        return {"output": res.stdout.strip()}
    except Exception as e:
        return {"error": str(e)}

# Local Semantic Scoring + Intent-Aware Answer Fallback (Triggers automatically if Gemini API is 503/busy)
def local_fallback_router_and_answer(user_query: str):
    q = user_query.lower()

    if any(bad in q for bad in UNSAFE_KEYWORDS):
        raise HTTPException(
            status_code=400,
            detail="Security Guardrail Blocked: Destructive or state-modifying commands are strictly prohibited."
        )

    # Score each tool by keyword overlap (zero hardcoded if-else chain)
    best_tool = None
    best_score = 0
    for tool_name, meta in TOOL_REGISTRY.items():
        score = sum(1 for kw in meta["keywords"] if kw in q)
        if score > best_score:
            best_score = score
            best_tool = tool_name

    if not best_tool:
        raise HTTPException(
            status_code=400,
            detail="Security Guardrail Blocked: Query is outside permitted Linux hardware & system diagnostics."
        )

    telemetry = execute_tool(best_tool)

    # Generate distinct, question-specific answer locally
    if best_tool == "get_memory_summary" and "total" in telemetry:
        tot = round(telemetry["total"] / (1024**3), 2)
        used = round(telemetry["used"] / (1024**3), 2)
        free = round(telemetry["free"] / (1024**3), 2)
        pct = round((telemetry["used"] / telemetry["total"]) * 100, 1)
        if any(w in q for w in ["free", "available", "left"]):
            ans = f"You currently have {free} GB of free RAM available out of {tot} GB total capacity."
        elif any(w in q for w in ["used", "consuming"]):
            ans = f"Active workloads are currently consuming {used} GB ({pct}%) of your system memory."
        else:
            ans = f"Your system has {tot} GB total installed RAM ({used} GB used, {free} GB free)."
    elif best_tool == "get_cpu_info" and "model_name" in telemetry:
        if "core" in q:
            ans = f"This processor provides {telemetry['cpu_cores']} CPU cores ({telemetry['model_name']})."
        elif "arch" in q:
            ans = f"Your system runs on {telemetry['architecture']} CPU architecture."
        else:
            ans = f"Installed CPU: {telemetry['model_name']} ({telemetry['architecture']}, {telemetry['cpu_cores']} cores)."
    elif best_tool == "get_block_devices" and "devices" in telemetry:
        devs = telemetry["devices"]
        if "mount" in q:
            mounts = ", ".join(f"{d['name']} mounted at {d['mountpoint']}" for d in devs)
            ans = f"Active filesystem mount points: {mounts}."
        else:
            ans = f"Detected {len(devs)} storage devices: {devs[0]['name']} ({devs[0]['size']} {devs[0]['type']}) and {devs[1]['name']} ({devs[1]['size']} {devs[1]['type']})."
    elif best_tool == "get_system_uptime" and "uptime" in telemetry:
        ans = f"The node has been up continuously for {telemetry['uptime']} with a healthy load average of {telemetry['load_average']}."
    elif best_tool == "get_os_kernel" and "kernel" in telemetry:
        ans = f"Host '{telemetry['hostname']}' is running {telemetry['os_name']} on Linux Kernel {telemetry['kernel']}."
    elif best_tool == "get_network_interfaces" and "interfaces" in telemetry:
        eth = telemetry["interfaces"][0]
        ans = f"Primary network interface {eth['name']} is {eth['status']} with IPv4 address {eth['ip']}."
    elif best_tool == "get_top_processes" and "top_processes" in telemetry:
        top = telemetry["top_processes"][0]
        ans = f"Top resource consumer is '{top['command']}' (PID {top['pid']}) using {top['mem_pct']}% RAM and {top['cpu_pct']}% CPU—check this process if experiencing slowness."
    elif best_tool == "get_open_ports" and "listening_ports" in telemetry:
        ports = ", ".join(f"{p['port']} ({p['service']})" for p in telemetry["listening_ports"])
        ans = f"Currently active listening TCP ports: {ports}."
    else:
        ans = "System diagnostics retrieved successfully."

    return best_tool, ans, telemetry

def call_gemini_with_fallback(client, contents, config=None):
    models_to_try = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"]
    last_error = None
    for model_name in models_to_try:
        try:
            return client.models.generate_content(
                model=model_name,
                contents=contents,
                config=config
            )
        except Exception as e:
            last_error = e
            err_str = str(e)
            if any(code in err_str for code in ["404", "503", "429", "NOT_FOUND", "UNAVAILABLE", "RESOURCE_EXHAUSTED"]):
                continue
            raise
    raise last_error

def route_and_answer_with_ai(user_query: str):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return local_fallback_router_and_answer(user_query)

    try:
        client = genai.Client(api_key=api_key)
        tool_catalog = "\n".join([f"- {k}: {v['description']}" for k, v in TOOL_REGISTRY.items()])

        routing_prompt = f"""You are a Linux SysAdmin security router.
Available read-only diagnostic tools:
{tool_catalog}

User Question: "{user_query}"

Respond ONLY with valid JSON:
- If the question maps to one of the tools above: {{"tool": "<exact_tool_name>"}}
- If the question asks to modify/delete files, execute arbitrary commands, or is unrelated to Linux hardware/system diagnostics: {{"reject": "<concise security reason>"}}"""

        route_res = call_gemini_with_fallback(
            client,
            contents=routing_prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        decision = json.loads(route_res.text)

        if "reject" in decision:
            raise HTTPException(status_code=400, detail=f"Security Guardrail Blocked: {decision['reject']}")

        tool_name = decision.get("tool")
        if tool_name not in TOOL_REGISTRY:
            raise HTTPException(status_code=400, detail="Security Guardrail Blocked: Requested action is not in the allow-listed tools.")

        telemetry = execute_tool(tool_name)

        answer_prompt = f"""User asked: "{user_query}"
Executed Linux Tool: {tool_name}
Raw System Telemetry: {json.dumps(telemetry)}

Write a clear, concise answer (2-3 sentences max) that directly answers the user's specific question using the telemetry data. Convert bytes to GB (1 GB = 1073741824 bytes) if discussing RAM."""

        final_res = call_gemini_with_fallback(client, contents=answer_prompt)
        return tool_name, final_res.text.strip(), telemetry

    except HTTPException:
        raise
    except Exception:
        # Automatic resilience: never fail demo if cloud API spikes with 503/429
        return local_fallback_router_and_answer(user_query)

@app.post("/api/ask")
def ask_assistant(req: QueryRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    tool_name, summary, result = route_and_answer_with_ai(req.query)
    return {
        "tool_executed": tool_name,
        "summary": summary,
        "result": result
    }