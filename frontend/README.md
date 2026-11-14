# AI-Powered Linux Hardware & SysAdmin Q&A Assistant

A secure, full-stack diagnostic assistant built with **React**, **FastAPI**, and **Gemini AI** that answers natural-language questions about Linux system hardware, performance, networking, and OS telemetry—while enforcing strict command allow-listing and prompt-injection guardrails.

## Key Highlights & Architecture

- **Data-Driven Allow-Listed Tool Registry (8 Read-Only Tools):** Eliminates hardcoded `if-else` routing chains and prevents arbitrary shell execution (`shell=False` with strict binary allow-listing).
- **Hybrid AI Intent Routing + Automatic Failover:** Uses Gemini LLM to map 100+ natural-language troubleshooting queries to exact diagnostic tools and generate question-specific human answers—with built-in automatic fallback to local semantic scoring if cloud API rate limits or 503 spikes occur.
- **Cross-Platform Telemetry Simulation:** Executes native Linux commands (`free`, `lscpu`, `lsblk`, `uptime`, `uname`, `ip`, `ps`, `ss`) on Linux hosts and seamlessly provides realistic simulated telemetry when tested on Windows development machines.
- **Interactive React Dashboard:** Visualizes RAM utilization bars, CPU/OS metric cards, block device mount points, active network ports, top resource-consuming processes, raw JSON payloads, and recent query history.

## Allow-Listed Diagnostic Tools

| Tool Name | Linux Command | Diagnostic Scope |
| :--- | :--- | :--- |
| `get_memory_summary` | `free -b` | Total, used, and free RAM capacity & utilization % |
| `get_cpu_info` | `lscpu` | Processor model, architecture (`x86_64`), and core count |
| `get_block_devices` | `lsblk -J -o NAME,SIZE,TYPE,MOUNTPOINT` | Storage drives (`NVMe`/`SSD`/`HDD`), sizes, and mount points |
| `get_system_uptime` | `uptime -p` | Continuous system uptime and 1m/5m/15m load averages |
| `get_os_kernel` | `uname -a` | Linux distribution, kernel version, and node hostname |
| `get_network_interfaces` | `ip -br a` | Active network interfaces (`eth0`, `lo`), status, and IPv4 addresses |
| `get_top_processes` | `ps -eo pid,comm,%cpu,%mem --sort=-%mem` | Top CPU/RAM-consuming processes for lag & bottleneck diagnosis |
| `get_open_ports` | `ss -tuln` | Active listening TCP/UDP ports and bound services |

## Security Guardrails

1. **Zero Arbitrary Shell Execution:** User queries never touch `os.system()` or `shell=True`. Only pre-approved command arrays in `TOOL_REGISTRY` can run.
2. **Destructive & Out-of-Scope Rejection:** Requests involving file deletion, process termination, reboots, or non-diagnostic topics are blocked at the routing layer with HTTP `400` security alerts.
3. **Subprocess Timeout Protection:** Every system command runs with a strict `5-second` timeout to prevent hung processes.

## Setup & Running Locally

1. **Backend (FastAPI):** Install `fastapi`, `uvicorn`, `pydantic`, `google-genai`, set `$env:GEMINI_API_KEY`, and run `uvicorn main:app --reload` inside `linux-hardware-assistant`.
2. **Frontend (React):** Run `npm install` and `npm run dev` inside `linux-hardware-assistant/frontend`.

**Developed by:** Pagoti Vijayalakshmi