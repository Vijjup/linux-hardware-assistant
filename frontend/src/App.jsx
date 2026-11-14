import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [query, setQuery] = useState('Why is my server running slow?');
  const [response, setResponse] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sampleQuestions = [
    { label: 'Why is server slow?', text: 'Why is my server running slow?' },
    { label: 'Free RAM left?', text: 'How much free RAM is available right now?' },
    { label: 'Total RAM capacity?', text: 'What is the total installed memory on this machine?' },
    { label: 'CPU Cores?', text: 'How many CPU cores does this processor have?' },
    { label: 'Disk Mounts?', text: 'Where are my storage drives mounted?' },
    { label: 'Open Ports?', text: 'Which network ports are currently listening?' },
    { label: 'System Uptime?', text: 'How long has the node been up and what is the load?' },
    { label: 'Kernel Version?', text: 'Which Linux kernel and OS version is running?' },
    { label: 'IP Address?', text: 'What is my primary IPv4 address?' },
    { label: 'Test Guardrail', text: 'Delete /var/log/syslog to free space' }
  ];

  const fetchHardwareInfo = async (searchQuery) => {
    setLoading(true);
    setError('');
    setResponse(null);

    try {
      const res = await axios.post('http://127.0.0.1:8000/api/ask', { query: searchQuery });
      setResponse(res.data);
      setHistory((prev) => [{ question: searchQuery, ...res.data }, ...prev.slice(0, 4)]);
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
        <div style={{ marginTop: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', fontWeight: 'bold' }}>
            <span>Memory Utilization ({usedPercent}%)</span>
            <span>{usedGB} GB / {totalGB} GB</span>
          </div>
          <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ width: `${usedPercent}%`, height: '100%', background: usedPercent > 80 ? '#e53e3e' : '#38a169' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '12px' }}>
            <div style={cardStyle}><strong>Total RAM</strong><div>{totalGB} GB</div></div>
            <div style={cardStyle}><strong>Used RAM</strong><div>{usedGB} GB</div></div>
            <div style={cardStyle}><strong>Free RAM</strong><div>{freeGB} GB</div></div>
          </div>
        </div>
      );
    }

    if (tool_executed === 'get_cpu_info' && result.model_name) {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '15px' }}>
          <div style={cardStyle}><strong>Processor</strong><div>{result.model_name}</div></div>
          <div style={cardStyle}><strong>Architecture</strong><div>{result.architecture}</div></div>
          <div style={cardStyle}><strong>Cores</strong><div>{result.cpu_cores} Cores</div></div>
        </div>
      );
    }

    if (tool_executed === 'get_block_devices' && result.devices) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
          {result.devices.map((dev, idx) => (
            <div key={idx} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><strong>/dev/{dev.name}</strong> ({dev.type})</span>
              <span style={badgeStyle('#3182ce')}>{dev.size} • Mount: {dev.mountpoint}</span>
            </div>
          ))}
        </div>
      );
    }

    if (tool_executed === 'get_system_uptime' && result.uptime) {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '15px' }}>
          <div style={cardStyle}><strong>Continuous Uptime</strong><div>{result.uptime}</div></div>
          <div style={cardStyle}><strong>Load Average (1m, 5m, 15m)</strong><div>{result.load_average}</div></div>
        </div>
      );
    }

    if (tool_executed === 'get_os_kernel' && result.kernel) {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '15px' }}>
          <div style={cardStyle}><strong>OS Distribution</strong><div>{result.os_name}</div></div>
          <div style={cardStyle}><strong>Kernel</strong><div>{result.kernel}</div></div>
          <div style={cardStyle}><strong>Hostname</strong><div>{result.hostname}</div></div>
        </div>
      );
    }

    if (tool_executed === 'get_network_interfaces' && result.interfaces) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
          {result.interfaces.map((iface, idx) => (
            <div key={idx} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><strong>{iface.name}</strong> ({iface.ip})</span>
              <span style={badgeStyle(iface.status === 'UP' ? '#38a169' : '#718096')}>{iface.status}</span>
            </div>
          ))}
        </div>
      );
    }

    if (tool_executed === 'get_top_processes' && result.top_processes) {
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px', background: '#fff', fontSize: '13px', borderRadius: '6px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: '#edf2f7', textAlign: 'left' }}>
              <th style={thStyle}>PID</th>
              <th style={thStyle}>Process</th>
              <th style={thStyle}>CPU %</th>
              <th style={thStyle}>RAM %</th>
            </tr>
          </thead>
          <tbody>
            {result.top_processes.map((proc) => (
              <tr key={proc.pid} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={tdStyle}>{proc.pid}</td>
                <td style={tdStyle}><strong>{proc.command}</strong></td>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '15px' }}>
          {result.listening_ports.map((p, idx) => (
            <div key={idx} style={cardStyle}>
              <strong>Port {p.port} ({p.protocol})</strong>
              <div style={{ color: '#2b6cb0', marginTop: '4px' }}>{p.service}</div>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ maxWidth: '760px', margin: '30px auto', fontFamily: 'system-ui, sans-serif', padding: '26px', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 8px 20px rgba(0,0,0,0.06)', background: '#fff' }}>
      <h2 style={{ color: '#1a202c', textAlign: 'center', marginBottom: '4px' }}>AI Linux SysAdmin & Hardware Assistant</h2>
      <p style={{ color: '#718096', textAlign: 'center', fontSize: '14px', marginTop: 0 }}>
        LLM-Routed Diagnostics • 8 Allow-Listed Tools • Zero Hardcoded Rules
      </p>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '16px' }}>
        {sampleQuestions.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => { setQuery(item.text); fetchHardwareInfo(item.text); }}
            style={{
              padding: '5px 11px',
              fontSize: '12px',
              borderRadius: '14px',
              border: item.label === 'Test Guardrail' ? '1px solid #feb2b2' : '1px solid #cbd5e0',
              background: item.label === 'Test Guardrail' ? '#fff5f5' : '#f7fafc',
              color: item.label === 'Test Guardrail' ? '#c53030' : '#2d3748',
              cursor: 'pointer'
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleAsk} style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask any Linux hardware, process, port, or system question..."
          style={{ flex: 1, padding: '11px 14px', fontSize: '15px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
        />
        <button type="submit" disabled={loading} style={{ padding: '11px 22px', background: '#2b6cb0', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}>
          {loading ? 'Analyzing...' : 'Ask AI'}
        </button>
      </form>

      {error && (
        <div style={{ color: '#c53030', background: '#fff5f5', border: '1px solid #feb2b2', padding: '12px', borderRadius: '6px', marginTop: '16px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {response && (
        <div style={{ marginTop: '22px', background: '#f8fafc', padding: '18px', borderRadius: '8px', borderLeft: '4px solid #38a169' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#718096', fontWeight: 'bold' }}>
              AI Diagnostic Answer
            </span>
            <code style={{ background: '#edf2f7', color: '#2b6cb0', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>
              {response.tool_executed}
            </code>
          </div>

          <p style={{ fontSize: '15px', color: '#1a202c', margin: '10px 0', lineHeight: '1.55', fontWeight: '500' }}>
            {response.summary}
          </p>

          {renderVisualMetrics()}

          <details style={{ marginTop: '14px', fontSize: '13px', color: '#4a5568' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '500' }}>Raw Telemetry Payload (JSON)</summary>
            <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: '12px', borderRadius: '6px', overflowX: 'auto', marginTop: '8px' }}>
              {JSON.stringify(response.result, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {history.length > 1 && (
        <div style={{ marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#718096', marginBottom: '8px' }}>RECENT QUERIES</div>
          {history.slice(1).map((item, idx) => (
            <div key={idx} style={{ fontSize: '13px', padding: '8px 10px', background: '#f7fafc', borderRadius: '6px', marginBottom: '6px' }}>
              <strong>Q: {item.question}</strong> <code style={{ color: '#2b6cb0' }}>[{item.tool_executed}]</code>
              <div style={{ color: '#4a5568', marginTop: '2px' }}>{item.summary}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const cardStyle = {
  background: '#ffffff',
  padding: '10px 12px',
  borderRadius: '6px',
  border: '1px solid #e2e8f0',
  textAlign: 'center',
  fontSize: '13px',
  color: '#2d3748'
};

const badgeStyle = (bg) => ({
  background: bg,
  color: '#fff',
  padding: '3px 10px',
  borderRadius: '12px',
  fontSize: '12px'
});

const thStyle = { padding: '8px 10px', borderBottom: '1px solid #cbd5e0' };
const tdStyle = { padding: '8px 10px' };

export default App;