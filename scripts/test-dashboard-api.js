const http = require("http");

async function test() {
  console.log("Registering admin to get token...");
  const adminData = JSON.stringify({
    name: "Admin Demo",
    firstName: "Admin",
    lastName: "Demo",
    email: `admin${Date.now()}@test.com`,
    password: "password123",
    role: "admin",
  });

  const regOpts = {
    hostname: "localhost",
    port: 5000,
    path: "/api/auth/register",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(adminData),
    },
  };

  const token = await new Promise((resolve, reject) => {
    const req = http.request(regOpts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(JSON.parse(data).data.token));
    });
    req.on("error", reject);
    req.write(adminData);
    req.end();
  });

  console.log("Testing /api/dashboard/stats ...");
  const getOpts = {
    hostname: "localhost",
    port: 5000,
    path: "/api/dashboard/stats",
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const result = await new Promise((resolve, reject) => {
    const req = http.request(getOpts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.end();
  });

  console.log(result);

  console.log("Testing /api/dashboard/donations ...");
  const getOpts2 = {
    hostname: "localhost",
    port: 5000,
    path: "/api/dashboard/donations",
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const result2 = await new Promise((resolve, reject) => {
    const req = http.request(getOpts2, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.end();
  });

  console.log(result2);

  console.log("Testing /api/dashboard/recent-donations ...");
  const getOpts3 = {
    hostname: "localhost",
    port: 5000,
    path: "/api/dashboard/recent-donations",
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const result3 = await new Promise((resolve, reject) => {
    const req = http.request(getOpts3, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.end();
  });

  console.log(result3);
}

test().catch(console.error);
