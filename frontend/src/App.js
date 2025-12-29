import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  const API = "http://127.0.0.1:8000";

  useEffect(() => {
    fetch(`${API}/history`)
      .then((res) => res.json())
      .then(setHistory);
  }, []);

  const upload = async () => {
    if (!file) return;

    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${API}/analyze`, {
      method: "POST",
      body: form,
    });

    const data = await res.json();
    setResult(data);

    const hist = await fetch(`${API}/history`).then((r) => r.json());
    setHistory(hist);
  };

  return (
    <div className="app">
      <h1>Data Drift Monitor</h1>

      <div className="card">
        <div className="upload-row">
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />
          <button onClick={upload}>Analyze</button>
        </div>
      </div>

      {result && (
        <div className="card">
          <h3>Analysis Result</h3>
          <p className={result.drift.length ? "drift" : "no-drift"}>
            {result.drift.length ? "⚠ Drift Detected" : "✓ No Drift Detected"}
          </p>
          <div className="result-box">
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        </div>
      )}

      <div className="card">
        <h3>Snapshot History</h3>
        <ul className="history-list">
          {history.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
