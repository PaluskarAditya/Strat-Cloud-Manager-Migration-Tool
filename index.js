const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const fs = require("fs");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const { XMLParser } = require("fast-xml-parser");
const {
  createSecurityRules,
  createZones,
  createTags,
  createAddressObjects,
} = require("./controllers");
const SECURITY_RULES_BASE_API =
  "https://api.strata.paloaltonetworks.com/config/security/v1/security-rules";
const ZONES_BASE_API =
  "https://api.strata.paloaltonetworks.com/config/network/v1/zones";
const TAGS_BASE_API =
  "https://api.strata.paloaltonetworks.com/config/objects/v1/tags";
const ADDRESS_BASE_API =
  "https://api.strata.paloaltonetworks.com/config/objects/v1/addresses";

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.post("/api/v1/login", async (req, res) => {
  const { id, secret, tsgId } = req.body;

  if (!id || !secret || !tsgId) {
    return res.status(400).json({ error: "Missing id or secret or tsgId" });
  }

  const creds = Buffer.from(`${id}:${secret}`).toString("base64");
  const payload = new URLSearchParams({
    grant_type: "client_credentials",
    scope: `tsg_id:${tsgId}`,
  });

  try {
    const response = await fetch(
      "https://auth.apps.paloaltonetworks.com/oauth2/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${creds}`,
        },
        body: payload.toString(),
      },
    );

    const data = await response.json();

    if (response.status == 200)
      res.cookie("access_token", data.access_token, { httpOnly: true });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error during authentication:", err);
  }
});

app.get("/api/v1/get-devices", async (req, res) => {
  const token = req.cookies.access_token;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const response = await fetch(
      "https://api.strata.paloaltonetworks.com/config/setup/v1/folders",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const data = await response.json();

    // console.log("Raw devices response:", data);

    const devices = data.data.filter(
      (item) => item.device_only === true && item.type === "on-prem",
    );

    res.status(200).json(devices);
  } catch (error) {
    console.error("Error fetching devices:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/v1/import-backup", upload.single("backup"), async (req, res) => {
  const token = req.cookies.access_token;
  const { serial } = req.body;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const filePath = req.file.path;
  const backup = fs.readFileSync(filePath, "utf-8");

  if (!backup) {
    return res.status(400).json({ error: "Missing backup data" });
  }

  // console.log("Backup data received:", backup);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
  });

  const jsonData = parser.parse(backup);

  fs.unlinkSync(filePath);

  const securityTags = jsonData.config.devices.entry.vsys.entry.tag.entry;
  const securityZones = jsonData.config.devices.entry.vsys.entry.zone.entry;
  const securityRules =
    jsonData.config.devices.entry.vsys.entry.rulebase.security.rules.entry;
  const securityObjects = jsonData.config.devices.entry.vsys.entry.address.entry;

  const rules = createSecurityRules(securityRules);
  const zones = createZones(securityZones);
  const tags = createTags(securityTags);
  const addresses = createAddressObjects(securityObjects, "ngfw-shared");

  // console.log("Extracted Security Rules:", JSON.stringify(rules, null, 2));
  // console.log("Extracted Zones:", JSON.stringify(zones, null, 2));
  // console.log("Extracted Tags:", JSON.stringify(tags, null, 2));
  console.log("Extracted Addresses:", JSON.stringify(addresses, null, 2));

  for (const tag of tags) {
    const response = await fetch(TAGS_BASE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(tag),
    });

    const data = await response.json();

    if (data["_error"]) {
      console.error(`Error creating tag ${tag.name}:`, data["_error"]);
    } else {
      console.log(`Successfully created tag ${tag.name}`);
    }
  }

  setTimeout(() => {
    console.log("All tags processed");
  }, 3000);

  for (const address of addresses) {
    const response = await fetch(ADDRESS_BASE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(address),
    });

    const data = await response.json();

    if (data["_error"]) {
      console.error(`Error creating address ${address.name}:`, data["_error"]);
    } else {
      console.log(`Successfully created address ${address.name}`);
    }
  }

  setTimeout(() => {
    console.log("All addresses processed");
  }, 3000);

  for (const zone of zones) {
    const response = await fetch(ZONES_BASE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(zone),
    });

    const data = await response.json();

    if (data["_error"]) {
      console.error(`Error creating zone ${zone.name}:`, data["_error"]);
    } else {
      console.log(`Successfully created zone ${zone.name}`);
    }
  }

  setTimeout(() => {
    console.log("All zones processed");
  }, 3000);

  for (const rule of rules) {
    const response = await fetch(SECURITY_RULES_BASE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(rule),
    });

    const data = await response.json();

    if (data["_error"]) {
      console.error(`Error creating rule ${rule.name}:`, data["_error"]);
    } else {
      console.log(`Successfully created rule ${rule.name}`);
    }
  }

  console.log("All rules processed");

  res.status(200).json({ success: true });
});

app.get("/", (req, res) => res.sendFile(__dirname + "/templates/index.html"));

app.get("/scm/dashboard", (req, res) => {
  const token = req.cookies.access_token;

  if (!token) {
    return res.status(401).redirect("/");
  }

  // In a real application, you would verify the token here
  res.sendFile(__dirname + "/templates/dashboard-new.html");
});

app.get("/foo", (req, res) => res.send("bar"));

app.listen(9090, () => console.log("Server running on port 9090"));
