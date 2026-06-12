import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const CLIENT_ID = import.meta.env.VITE_SF_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_SF_REDIRECT_URI;

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("sf_token"));
  const [environment, setEnvironment] = useState("Production");
  const [rules, setRules] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && !token) {
      const params = new URLSearchParams(hash.substring(1));
      const access_token = params.get("access_token");
      const instance_url = params.get("instance_url");

      if (access_token && instance_url) {
        localStorage.setItem("sf_token", access_token);
        localStorage.setItem("sf_instance_url", instance_url);
        
        setToken(access_token);
        window.location.hash = ""; 
      }
    }
  }, []);

  useEffect(() => {
    if (token) fetchMetadata();
  }, [token]);

  const getConfig = () => ({
    headers: {
      "Authorization": `Bearer ${localStorage.getItem("sf_token")}`,
      "sf-instance-url": localStorage.getItem("sf_instance_url")
    }
  });

  const handleLogin = () => {
    const baseUrl = environment === "Production" 
      ? "https://login.salesforce.com" 
      : "https://test.salesforce.com";
      
    const authUrl = `${baseUrl}/services/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=token`;
    window.location.href = authUrl;
  };

  const fetchMetadata = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/user-metadata`, getConfig());
      setMetadata(res.data);
    } catch (err) {
      console.error("Failed to fetch metadata", err);
      if (err.response?.status === 401) logout(); 
    }
  };

  const fetchRules = async () => {
    try {
      setLoading(true);
      setMessage("Querying metadata...");
      const res = await axios.get(`${API_URL}/api/validation-rules`, getConfig());
      setRules(res.data || []);
      setMessage("");
    } catch (err) {
      setMessage("Failed to fetch rules.");
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = async (id, currentStatus) => {
    try {
      setLoading(true);
      await axios.patch(`${API_URL}/api/toggle-rule/${id}`, { active: !currentStatus }, getConfig());
      fetchRules();
    } catch (err) {
      setMessage("Failed to toggle rule.");
      setLoading(false);
    }
  };

  const toggleAll = async (status) => {
    try {
      setLoading(true);
      setMessage(`Deploying changes...`);
      const ruleIds = rules.map(r => r.Id);
      
      await axios.post(`${API_URL}/api/toggle-all`, { active: status, ruleIds: ruleIds }, getConfig());
      fetchRules();
    } catch (err) {
      setMessage("Failed to apply bulk toggle.");
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setMetadata(null);
    setRules([]);
    window.location.reload();
  };

  return (
    <div className="container">
      <h1 className="page-title">Salesforce Switch</h1>
      
      {!token ? (
        <div className="card-section">
          <p>Please select your environment and login to connect your Org.</p>
          <div className="flex-row">
            <select 
              className="select-input"
              value={environment} 
              onChange={(e) => setEnvironment(e.target.value)}
            >
              <option value="Production">Production / Developer</option>
              <option value="Sandbox">Sandbox</option>
            </select>
            <button className="btn btn-primary" onClick={handleLogin}>
              Login with Salesforce
            </button>
          </div>
        </div>
      ) : (
        <div className="card-section">
          <h3>Connection Details</h3>
          {metadata && (
            <ul className="metadata-list">
              <li><strong>Organisation:</strong> {metadata.organization}</li>
              <li><strong>Instance:</strong> {metadata.instance}</li>
            </ul>
          )}
          <div className="flex-row" style={{ marginTop: "8px" }}>
            <button className="btn btn-danger" onClick={logout}>
              Disconnect
            </button>
            <button className="btn btn-primary" onClick={fetchRules} disabled={loading}>
              Fetch Validation Rules
            </button>
          </div>
        </div>
      )}

      {message && <div className="message">{message}</div>}

      {rules.length > 0 && (
        <div style={{ marginTop: "32px" }}>
          <div className="flex-between">
            <h3 style={{ fontSize: "18px", color: "var(--text-main)" }}>Account Rules</h3>
            <div className="flex-row">
              <button className="btn btn-success" onClick={() => toggleAll(true)} disabled={loading}>
                Enable All
              </button>
              <button className="btn btn-danger" onClick={() => toggleAll(false)} disabled={loading}>
                Disable All
              </button>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Validation Rule Name</th>
                  <th style={{ width: "120px", textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.Id}>
                    <td>{r.ValidationName}</td>
                    <td style={{ textAlign: "center" }}>
                      <button 
                        onClick={() => toggleRule(r.Id, r.Active)} 
                        className={`btn btn-toggle ${r.Active ? 'toggle-on' : 'toggle-off'}`}
                        disabled={loading}
                      >
                        {r.Active ? "ON" : "OFF"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}