from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
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

class HistoryItem(BaseModel):
    question: str
    tool_executed: Optional[str] = None
    summary: Optional[str] = None

class QueryRequest(BaseModel):
    query: str
    history: Optional[List[HistoryItem]] = []

def format_memory(t: dict, q: str) -> str:
    if "total" not in t:
        return t.get("output", "Memory telemetry retrieved.")
    tot = round(t["total"] / (1024**3), 2)
    used = round(t["used"] / (1024**3), 2)
    free = round(t["free"] / (1024**3), 2)
    pct = round((t["used"] / t["total"]) * 100, 1)
    if any(w in q for w in ["free", "available", "left"]):
        return f"You currently have {free} GB of free RAM available out of {tot} GB total capacity."
    if any(w in q for w in ["used", "consuming"]):
        return f"Active workloads are currently consuming {used} GB ({pct}%) of your system memory."
    return f"Your system has {tot} GB total installed RAM ({used} GB used, {free} GB free)."

def format_cpu(t: dict, q: str) -> str:
    if "model_name" not in t:
        return t.get("output", "CPU telemetry retrieved.")
    if "core" in q:
        return f"This processor provides {t['cpu_cores']} CPU cores ({t['model_name']})."
    if "arch" in q:
        return f"Your system runs on {t['architecture']} CPU architecture."
    return f"Installed CPU: {t['model_name']} ({t['architecture']}, {t['cpu_cores']} cores)."

def format_storage(t: dict, q: str) -> str:
    if "devices" not in t:
        return t.get("output", "Storage telemetry retrieved.")
    devs = t["devices"]
    if "mount" in q:
        mounts = ", ".join(f"{d['name']} mounted at {d['mountpoint']}" for d in devs)
        return f"Active filesystem mount points: {mounts}."
    summary = ", ".join(f"{d['name']} ({d['size']} {d['type']})" for d in devs)
    return f"Detected {len(devs)} storage devices: {summary}."

def format_ports(t: dict, q: str) -> str:
    if "listening_ports" not in t:
        return t.get("output", "Open ports telemetry retrieved.")
    ports = ", ".join(f"{p['port']} ({p['service']})" for p in t["listening_ports"])
    return f"Currently active listening TCP ports: {ports}."

TOOL_REGISTRY = {
    "get_memory_summary": {
        "cmd": ["free", "-b"],
        "keywords": ["ram", "memory", "swap"],
        "description": "Get total, used, and free RAM memory statistics.",
        "simulated": {"total": 16106127360, "used": 8589934592, "free": 7516192768},
        "formatter": format_memory
    },
    "get_cpu_info": {
        "cmd": ["lscpu"],
        "keywords": ["cpu", "processor", "core", "cores", "architecture", "thread"],
        "description": "Get CPU processor model, architecture, and core count.",
        "simulated": {"architecture": "x86_64", "cpu_cores": 8, "model_name": "Intel Core i7-11700H"},
        "formatter": format_cpu
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
        },
        "formatter": format_storage
    },
    "get_system_uptime": {
        "cmd": ["uptime", "-p"],
        "keywords": ["uptime", "how long", "load", "boot", "up time", "been up"],
        "description": "Get system uptime duration and CPU load averages.",
        "simulated": {"uptime": "4 days, 6 hours, 22 minutes", "load_average": "0.42, 0.38, 0.31"},
        "formatter": lambda t, q: f"The node has been up continuously for {t['uptime']} with a healthy load average of {t['load_average']}." if "uptime" in t else t.get("output", "")
    },
    "get_os_kernel": {
        "cmd": ["uname", "-a"],
        "keywords": ["kernel", "os", "ubuntu", "linux", "version", "hostname", "distro"],
        "description": "Get Linux OS distribution, kernel version, and system hostname.",
        "simulated": {"os_name": "Ubuntu 22.04.4 LTS", "kernel": "6.5.0-44-generic", "hostname": "linux-prod-node01"},
        "formatter": lambda t, q: f"Host '{t['hostname']}' is running {t['os_name']} on Linux Kernel {t['kernel']}." if "kernel" in t else t.get("output", "")
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
        },
        "formatter": lambda t, q: f"Primary network interface {t['interfaces'][0]['name']} is {t['interfaces'][0]['status']} with IPv4 address {t['interfaces'][0]['ip']}." if "interfaces" in t else t.get("output", "")
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
        },
        "formatter": lambda t, q: f"Top resource consumer is '{t['top_processes'][0]['command']}' (PID {t['top_processes'][0]['pid']}) using {t['top_processes'][0]['mem_pct']}% RAM and {t['top_processes'][0]['cpu_pct']}% CPU—check this process if experiencing slowness." if "top_processes" in t else t.get("output", "")
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
        },
        "formatter": format_ports
    }
}

UNSAFE_KEYWORDS = ["delete", "rm ", "remove", "kill", "shutdown", "reboot", "format", "drop", "modify", "write"]
UNSUPPORTED_HARDWARE_HINTS = ["gpu", "graphics", "nvidia", "amd", "bios", "dmidecode", "motherboard", "serial", "temperature", "fan"]

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

def local_fallback_router_and_answer(user_query: str, history: List[HistoryItem] = None):
    q = user_query.lower()

    if any(bad in q for bad in UNSAFE_KEYWORDS):
        raise HTTPException(
            status_code=400,
            detail="Security Guardrail Blocked: Destructive or state-modifying commands are strictly prohibited."
        )

    if any(hw in q for hw in UNSUPPORTED_HARDWARE_HINTS):
        return (
            "unsupported_scope",
            "I don't have an allow-listed read-only tool for that hardware (such as GPU `lspci` or root-privileged `dmidecode` BIOS inspection), so I cannot verify those specs without guessing.",
            {"status": "not_available", "reason": "Requires unconfigured hardware utility or elevated root privileges"}
        )

    context_q = q
    if history and len(q.split()) <= 5:
        last_q = history[0].question.lower()
        context_q = f"{last_q} {q}"

    best_tool = None
    best_score = 0
    for tool_name, meta in TOOL_REGISTRY.items():
        score = sum(1 for kw in meta["keywords"] if kw in context_q)
        if score > best_score:
            best_score = score
            best_tool = tool_name

    if not best_tool:
        return (
            "unsupported_scope",
            "I don't know — that question falls outside my 8 allow-listed read-only Linux diagnostic tools, and I will not guess system specifications.",
            {"status": "out_of_scope"}
        )

    telemetry = execute_tool(best_tool)
    ans = TOOL_REGISTRY[best_tool]["formatter"](telemetry, q)
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

def route_and_answer_with_ai(user_query: str, history: List[HistoryItem] = None):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return local_fallback_router_and_answer(user_query, history)

    try:
        client = genai.Client(api_key=api_key)
        tool_catalog = "\n".join([f"- {k}: {v['description']}" for k, v in TOOL_REGISTRY.items()])
        recent_context = ""
        if history:
            recent_context = "Recent conversation context:\n" + "\n".join(
                [f"- User: {h.question} -> Tool: {h.tool_executed}" for h in history[:3]]
            )

        routing_prompt = f"""You are a Linux SysAdmin security router.
Available read-only diagnostic tools:
{tool_catalog}

{recent_context}
Current User Question: "{user_query}"

Respond ONLY with valid JSON:
- If the question (or follow-up) maps to one of the 8 tools above:
{{"tool": "<exact_tool_name>"}}
- If the question asks for hardware not covered by the 8 tools (e.g., GPU, BIOS/dmidecode, sensors) so you must not guess:
{{"unknown": "<concise explanation of missing tool or root permission>"}}
- If the question asks to modify/delete files or execute destructive commands:
{{"reject": "<concise security reason>"}}"""

        route_res = call_gemini_with_fallback(
            client,
            contents=routing_prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        decision = json.loads(route_res.text)

        if "reject" in decision:
            raise HTTPException(status_code=400, detail=f"Security Guardrail Blocked: {decision['reject']}")

        if "unknown" in decision:
            return "unsupported_scope", f"I don't know — {decision['unknown']}", {"status": "not_available"}

        tool_name = decision.get("tool")
        if tool_name not in TOOL_REGISTRY:
            return "unsupported_scope", "I don't know — that metric is outside my allow-listed diagnostic tools.", {"status": "out_of_scope"}

        telemetry = execute_tool(tool_name)

        answer_prompt = f"""User asked: "{user_query}"
Executed Linux Tool: {tool_name}
Raw System Telemetry: {json.dumps(telemetry)}

Write a clear, concise answer (2-3 sentences max) grounded strictly in the telemetry data above. Never guess missing specs. Convert bytes to GB (1 GB = 1073741824 bytes) if discussing RAM."""

        final_res = call_gemini_with_fallback(client, contents=answer_prompt)
        return tool_name, final_res.text.strip(), telemetry

    except HTTPException:
        raise
    except Exception:
        return local_fallback_router_and_answer(user_query, history)

@app.get("/api/telemetry")
def get_system_overview():
    return {
        "memory": execute_tool("get_memory_summary"),
        "cpu": execute_tool("get_cpu_info"),
        "os": execute_tool("get_os_kernel"),
        "uptime": execute_tool("get_system_uptime"),
        "tools": [
            {"name": k, "cmd": " ".join(v["cmd"]), "description": v["description"]}
            for k, v in TOOL_REGISTRY.items()
        ]
    }

@app.post("/api/ask")
def ask_assistant(req: QueryRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    tool_name, summary, result = route_and_answer_with_ai(req.query, req.history)
    return {
        "tool_executed": tool_name,
        "summary": summary,
        "result": result
    }