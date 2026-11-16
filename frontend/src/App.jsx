import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [query, setQuery] = useState('Why is my server running slow?');
  const [response, setResponse] = useState(null);
  const [overview, setOverview] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sampleQuestions = [
    { label: '⚡ Why is server slow?', text: 'Why is my server running slow?', danger: false },
    { label: '🧠 Free RAM left?', text: 'How much free RAM is available right now?', danger: false },
    { label: '⚙️ CPU Cores?', text: 'How many CPU cores does this processor have?', danger: false },
    { label: '💾 Disk Mounts?', text: 'Where are my storage drives mounted?', danger: false },
    { label: '🌐 Open Ports?', text: 'Which network ports are currently listening?', danger: false },
    { label: '⏱️ System Uptime?', text: 'How long has the node been up and what is the load?', danger: false },
    { label: '🐧 Kernel Version?', text: 'Which Linux kernel and OS version is running?', danger: false },
    { label: '🔌 IP Address?', text: 'What is my primary IPv4 address?', danger: false },
    { label: '❓ What about the GPU?', text: 'And what about the GPU specs?', danger: false },
    { label: '🛡️ Test Guardrail Block', text: 'Delete /var/log/syslog to free space', danger: true }
  ];

  useEffect(() => {
    axios.get('/api/telemetry')
      .then((res) => setOverview(res.data))
      .catch(() => {});
  }, []);

  const fetchHardwareInfo = async (searchQuery) => {
    setLoading(true);
    setError('');
    setResponse(null);

    try {
      const res = await axios.post('/api/ask', {
        query: searchQuery,
        history: history.slice(0, 3)
      });
      setResponse(res.data);
      setHistory((prev) => [{ question: searchQuery, ...res.data, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 5)]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Backend offline. Run: uvicorn main:app --reload');
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = (e) => {
    e.preventDefault();
    if (query.trim()) fetchHardwareInfo(query);
  };

  const renderVisualMetrics = () => {
    if (!response?.result) return null;
    const { tool_executed, result } = response;

    if (tool_executed === 'get_memory_summary' && result.total) {
      const totalGB = (result.total / 1024 ** 3).toFixed(1);
      const usedGB = (result.used / 1024 ** 3).toFixed(1);
      const freeGB = (result.free / 1024 ** 3).toFixed(1);
      const usedPercent = Math.round((result.used / result.total) * 100);

      return (
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>
            <span>Memory Utilization ({usedPercent}%)</span>
            <span>{usedGB} GB / {totalGB} GB</span>
          </div>
          <div style={{ width: '100%', height: '10px', background: '#1f2937', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ width: `${usedPercent}%`, height: '100%', background: usedPercent > 80 ? '#ef4444' : '#10b981' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '12px' }}>
            <div style={metricCardStyle}><span style={metricLabelStyle}>Total RAM</span><div style={metricValStyle}>{totalGB} GB</div></div>
            <div style={metricCardStyle}><span style={metricLabelStyle}>Used RAM</span><div style={metricValStyle}>{usedGB} GB</div></div>
            <div style={metricCardStyle}><span style={metricLabelStyle}>Free RAM</span><div style={{ ...metricValStyle, color: '#34d399' }}>{freeGB} GB</div></div>
          </div>
        </div>
      );
    }

    if (tool_executed === 'get_cpu_info' && result.model_name) {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px' }}>
          <div style={metricCardStyle}><span style={metricLabelStyle}>Processor</span><div style={metricValStyle}>{result.model_name}</div></div>
          <div style={metricCardStyle}><span style={metricLabelStyle}>Architecture</span><div style={metricValStyle}>{result.architecture}</div></div>
          <div style={metricCardStyle}><span style={metricLabelStyle}>Logical Cores</span><div style={{ ...metricValStyle, color: '#818cf8' }}>{result.cpu_cores} Cores</div></div>
        </div>
      );
    }

    if (tool_executed === 'get_block_devices' && result.devices) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
          {result.devices.map((dev, idx) => (
            <div key={idx} style={{ ...metricCardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
              <span><strong style={{ color: '#f3f4f6' }}>/dev/{dev.name}</strong> <span style={{ color: '#9ca3af' }}>({dev.type})</span></span>
              <span style={badgeStyle('rgba(99, 102, 241, 0.2)', '#a5b4fc')}>{dev.size} • Mount: {dev.mountpoint}</span>
            </div>
          ))}
        </div>
      );
    }

    if (tool_executed === 'get_system_uptime' && result.uptime) {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginTop: '16px' }}>
          <div style={metricCardStyle}><span style={metricLabelStyle}>Continuous Uptime</span><div style={metricValStyle}>{result.uptime}</div></div>
          <div style={metricCardStyle}><span style={metricLabelStyle}>Load Average (1m, 5m, 15m)</span><div style={{ ...metricValStyle, color: '#34d399' }}>{result.load_average}</div></div>
        </div>
      );
    }

    if (tool_executed === 'get_os_kernel' && result.kernel) {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px' }}>
          <div style={metricCardStyle}><span style={metricLabelStyle}>OS Distribution</span><div style={metricValStyle}>{result.os_name}</div></div>
          <div style={metricCardStyle}><span style={metricLabelStyle}>Kernel</span><div style={metricValStyle}>{result.kernel}</div></div>
          <div style={metricCardStyle}><span style={metricLabelStyle}>Hostname</span><div style={{ ...metricValStyle, color: '#818cf8' }}>{result.hostname}</div></div>
        </div>
      );
    }

    if (tool_executed === 'get_network_interfaces' && result.interfaces) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
          {result.interfaces.map((iface, idx) => (
            <div key={idx} style={{ ...metricCardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
              <span><strong style={{ color: '#f3f4f6' }}>{iface.name}</strong> <span style={{ color: '#9ca3af' }}>({iface.ip})</span></span>
              <span style={badgeStyle(iface.status === 'UP' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(156, 163, 175, 0.15)', iface.status === 'UP' ? '#34d399' : '#9ca3af')}>{iface.status}</span>
            </div>
          ))}
        </div>
      );
    }

    if (tool_executed === 'get_top_processes' && result.top_processes) {
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px', background: '#0b0f19', fontSize: '13px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #1f2937' }}>
          <thead>
            <tr style={{ background: '#111827', textAlign: 'left', color: '#9ca3af' }}>
              <th style={thStyle}>PID</th>
              <th style={thStyle}>Process</th>
              <th style={thStyle}>CPU %</th>
              <th style={thStyle}>RAM %</th>
            </tr>
          </thead>
          <tbody>
            {result.top_processes.map((proc) => (
              <tr key={proc.pid} style={{ borderBottom: '1px solid #1f2937', color: '#e5e7eb' }}>
                <td style={tdStyle}>{proc.pid}</td>
                <td style={tdStyle}><strong style={{ color: '#818cf8' }}>{proc.command}</strong></td>
                <td style={tdStyle}>{proc.cpu_pct}%</td>
                <td style={tdStyle}>{proc.mem_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (tool_executed === 'get_open_ports' && result.listening_ports) {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px' }}>
          {result.listening_ports.map((p, idx) => (
            <div key={idx} style={metricCardStyle}>
              <span style={metricLabelStyle}>Port {p.port} ({p.protocol})</span>
              <div style={{ ...metricValStyle, color: '#34d399' }}>{p.service}</div>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  const memPct = overview?.memory?.total ? Math.round((overview.memory.used / overview.memory.total) * 100) : 53;
  const cpuCores = overview?.cpu?.cpu_cores || 8;
  const osLabel = overview?.os?.os_name || 'Ubuntu 22.04 LTS';
  const uptimeLabel = overview?.uptime?.uptime || '4 days, 6 hrs';

  return (
    <div style={{ minHeight: '100vh', background: '#0b0f19', color: '#f3f4f6', fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: '40px' }}>
      <header style={{ background: 'linear-gradient(90deg, #0f172a, #1e1b4b)', borderBottom: '1px solid #1f2937', padding: '18px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#6366f1', padding: '6px 12px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', boxShadow: '0 0 16px rgba(99, 102, 241, 0.35)' }}>
            LINUX-AI OPS
          </div>
          <div>
            <h1 style={{ fontSize: '19px', fontWeight: '700', margin: 0 }}>AI Linux Hardware & SysAdmin Assistant</h1>
            <span style={{ color: '#9ca3af', fontSize: '12px' }}>LLM-Routed Read-Only Diagnostics • Zero Arbitrary Shell Execution</span>
          </div>
        </div>
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: '600' }}>
          ● 8 Allow-Listed Tools | Guardrails Active
        </div>
      </header>

      <div style={{ maxWidth: '1240px', margin: '24px auto', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={kpiCardStyle}>
            <div style={kpiLabelStyle}>Host Operating System</div>
            <div style={kpiValueStyle}>{osLabel}</div>
            <div style={kpiSubStyle}>Read-only telemetry node</div>
          </div>
          <div style={kpiCardStyle}>
            <div style={kpiLabelStyle}>Memory Load (free -b)</div>
            <div style={kpiValueStyle}>{memPct}% Used</div>
            <div style={kpiSubStyle}>16.0 GB Installed Capacity</div>
          </div>
          <div style={kpiCardStyle}>
            <div style={kpiLabelStyle}>Compute Topology (lscpu)</div>
            <div style={kpiValueStyle}>{cpuCores} Cores</div>
            <div style={kpiSubStyle}>x86_64 Architecture</div>
          </div>
          <div style={kpiCardStyle}>
            <div style={kpiLabelStyle}>Node Uptime (uptime -p)</div>
            <div style={kpiValueStyle}>{uptimeLabel}</div>
            <div style={kpiSubStyle}>Zero destructive ops allowed</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '16px', padding: '22px' }}>
            <h2 style={{ fontSize: '16px', margin: '0 0 12px 0' }}>🔍 Natural Language Hardware & System Query</h2>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {sampleQuestions.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => { setQuery(item.text); fetchHardwareInfo(item.text); }}
                  style={{
                    padding: '6px 11px',
                    fontSize: '12px',
                    borderRadius: '8px',
                    border: item.danger ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid #374151',
                    background: item.danger ? 'rgba(239, 68, 68, 0.12)' : '#1f2937',
                    color: item.danger ? '#fca5a5' : '#e5e7eb',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleAsk} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask any Linux hardware, process, port, or system question..."
                style={{ flex: 1, padding: '12px 14px', fontSize: '14px', borderRadius: '10px', border: '1px solid #374151', background: '#0b0f19', color: '#f3f4f6', outline: 'none' }}
              />
              <button
                type="submit"
                disabled={loading}
                style={{ padding: '12px 22px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
              >
                {loading ? 'Inspecting...' : 'Run Diagnostic'}
              </button>
            </form>

            {error && (
              <div style={{ color: '#fca5a5', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', padding: '12px 14px', borderRadius: '10px', marginTop: '16px', fontSize: '13px', fontWeight: '500' }}>
                🛡️ {error}
              </div>
            )}

            {response && (
              <div style={{ marginTop: '20px', background: '#0b0f19', padding: '18px', borderRadius: '12px', border: '1px solid #1f2937', borderLeft: '4px solid #10b981' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#9ca3af', fontWeight: '700' }}>
                    AI Diagnostic Summary
                  </span>
                  <code style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                    Tool: {response.tool_executed}
                  </code>
                </div>

                <p style={{ fontSize: '15px', color: '#f3f4f6', margin: '12px 0', lineHeight: '1.6' }}>
                  {response.summary}
                </p>

                {renderVisualMetrics()}

                <details style={{ marginTop: '16px', fontSize: '12px', color: '#9ca3af' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: '600' }}>View Raw JSON Telemetry Payload</summary>
                  <pre style={{ background: '#05080f', color: '#34d399', padding: '12px', borderRadius: '8px', overflowX: 'auto', marginTop: '8px', border: '1px solid #1f2937' }}>
                    {JSON.stringify(response.result, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            {history.length > 0 && (
              <div style={{ marginTop: '24px', borderTop: '1px solid #1f2937', paddingTop: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '10px' }}>Audit Log (Recent Diagnostics)</div>
                {history.map((item, idx) => (
                  <div key={idx} style={{ fontSize: '13px', padding: '10px 12px', background: '#0b0f19', border: '1px solid #1f2937', borderRadius: '8px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong style={{ color: '#e5e7eb' }}>Q: {item.question}</strong>
                      <code style={{ color: '#818cf8', fontSize: '11px' }}>[{item.tool_executed}]</code>
                    </div>
                    <div style={{ color: '#9ca3af', marginTop: '4px', fontSize: '12px' }}>{item.summary}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '16px', padding: '20px' }}>
            <h3 style={{ fontSize: '15px', margin: '0 0 12px 0', color: '#f3f4f6' }}>🔒 Allow-Listed Read-Only Tools</h3>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px' }}>
              Only these 8 non-destructive commands can be invoked by the LLM router:
            </p>
            {(overview?.tools || [
              { name: 'get_memory_summary', cmd: 'free -b' },
              { name: 'get_cpu_info', cmd: 'lscpu' },
              { name: 'get_block_devices', cmd: 'lsblk -J' },
              { name: 'get_system_uptime', cmd: 'uptime -p' },
              { name: 'get_os_kernel', cmd: 'uname -a' },
              { name: 'get_network_interfaces', cmd: 'ip -br a' },
              { name: 'get_top_processes', cmd: 'ps -eo pid,comm,%cpu,%mem' },
              { name: 'get_open_ports', cmd: 'ss -tuln' }
            ]).map((t) => (
              <div key={t.name} style={{ padding: '8px 10px', background: '#0b0f19', border: '1px solid #1f2937', borderRadius: '8px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#e5e7eb' }}>{t.name}</span>
                <code style={{ fontSize: '11px', color: '#34d399', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>{t.cmd}</code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const kpiCardStyle = {
  background: '#111827',
  border: '1px solid #1f2937',
  borderRadius: '14px',
  padding: '16px 18px'
};

const kpiLabelStyle = {
  color: '#9ca3af',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const kpiValueStyle = {
  fontSize: '20px',
  fontWeight: '800',
  marginTop: '6px',
  color: '#ffffff'
};

const kpiSubStyle = {
  fontSize: '11px',
  color: '#10b981',
  marginTop: '4px'
};

const metricCardStyle = {
  background: '#111827',
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid #1f2937',
  textAlign: 'center',
  fontSize: '13px',
  color: '#e5e7eb'
};

const metricLabelStyle = {
  fontSize: '11px',
  color: '#9ca3af',
  textTransform: 'uppercase'
};

const metricValStyle = {
  fontSize: '15px',
  fontWeight: '700',
  marginTop: '4px',
  color: '#ffffff'
};

const badgeStyle = (bg, color) => ({
  background: bg,
  color,
  padding: '4px 10px',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: '600'
});

const thStyle = { padding: '10px 12px', borderBottom: '1px solid #1f2937' };
const tdStyle = { padding: '10px 12px' };

export default App;