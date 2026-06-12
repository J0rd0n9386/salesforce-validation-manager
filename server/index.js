import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

const PORT = process.env.PORT || 3001;

const getAuth = (req) => {
  const authHeader = req.headers.authorization || "";
  const accessToken = authHeader.replace("Bearer ", "");
  const instanceUrl = req.headers["sf-instance-url"];
  return { accessToken, instanceUrl };
};

app.get("/api/user-metadata", async (req, res) => {
  try {
    const { accessToken, instanceUrl } = getAuth(req);
    if (!accessToken || !instanceUrl) return res.status(401).json({ error: "Not authenticated" });

    const query = "SELECT Name FROM Organization LIMIT 1";
    const url = `${instanceUrl}/services/data/v60.0/query?q=${encodeURIComponent(query)}`;
    
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    res.json({
      organization: response.data.records[0]?.Name || "Unknown Org",
      instance: instanceUrl
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/validation-rules", async (req, res) => {
  try {
    const { accessToken, instanceUrl } = getAuth(req);
    if (!accessToken || !instanceUrl) return res.status(401).json({ error: "Not authenticated" });

    const query = "SELECT Id, ValidationName, Active FROM ValidationRule WHERE EntityDefinition.QualifiedApiName='Account'";
    const url = `${instanceUrl}/services/data/v60.0/tooling/query?q=${encodeURIComponent(query)}`;

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    res.json(response.data.records);
  } catch (error) {
    res.status(500).json(error.response?.data || { error: error.message });
  }
});

app.patch("/api/toggle-rule/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const { accessToken, instanceUrl } = getAuth(req);
    
    if (!accessToken || !instanceUrl) return res.status(401).json({ error: "Not authenticated" });

    const url = `${instanceUrl}/services/data/v60.0/tooling/sobjects/ValidationRule/${id}`;

    const getResponse = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const ruleData = getResponse.data;

  
    ruleData.Metadata.active = active;

    
    const patchResponse = await axios.patch(url, { Metadata: ruleData.Metadata }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    res.json(patchResponse.data);
  } catch (error) {
    res.status(500).json(error.response?.data || { error: error.message });
  }
});

app.post("/api/toggle-all", async (req, res) => {
  try {
    const { active, ruleIds } = req.body;
    const { accessToken, instanceUrl } = getAuth(req);
    
    if (!accessToken || !instanceUrl) return res.status(401).json({ error: "Not authenticated" });
    
    for (let id of ruleIds) {
      const url = `${instanceUrl}/services/data/v60.0/tooling/sobjects/ValidationRule/${id}`;
      
      const getResponse = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      const ruleData = getResponse.data;
      ruleData.Metadata.active = active;

      await axios.patch(url, { Metadata: ruleData.Metadata }, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
    }

    res.json({ success: true, message: `All rules set to ${active}` });
  } catch (error) {
    res.status(500).json(error.response?.data || { error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});