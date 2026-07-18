/**
 * Demo workflow smoke test for FoodBridge.
 *
 * Usage:
 *   node scripts/demo-workflow-smoke.js
 *
 * Optional:
 *   $env:DEMO_API_BASE="http://localhost:5062/api"; node scripts/demo-workflow-smoke.js
 */

const API_BASE = process.env.DEMO_API_BASE || "http://localhost:5000/api";
const PASSWORD = process.env.DEMO_PASSWORD || "DemoPass123!";

function splitSetCookieHeader(value) {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,=]+=[^;,]+)/g).map((entry) => entry.trim());
}

class ApiSession {
  constructor(label) {
    this.label = label;
    this.cookies = new Map();
    this.user = null;
  }

  get cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }

  get csrfToken() {
    return this.cookies.get("XSRF-TOKEN") || "";
  }

  storeCookies(response) {
    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : splitSetCookieHeader(response.headers.get("set-cookie"));

    setCookies.forEach((cookie) => {
      const firstPart = String(cookie).split(";")[0];
      const separator = firstPart.indexOf("=");
      if (separator === -1) return;
      const name = firstPart.slice(0, separator).trim();
      const value = firstPart.slice(separator + 1).trim();
      if (name) this.cookies.set(name, value);
    });
  }

  async request(method, endpoint, body) {
    const headers = {
      Accept: "application/json",
    };

    if (this.cookieHeader) headers.Cookie = this.cookieHeader;
    if (method !== "GET" && method !== "HEAD") {
      headers["Content-Type"] = "application/json";
      if (this.csrfToken) headers["X-CSRF-Token"] = this.csrfToken;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    this.storeCookies(response);

    const text = await response.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (_error) {
        data = { raw: text };
      }
    }

    if (!response.ok) {
      const message = data.message || `${method} ${endpoint} failed`;
      throw new Error(`${this.label}: ${message} (${response.status})`);
    }

    return data;
  }

  get(endpoint) {
    return this.request("GET", endpoint);
  }

  post(endpoint, body) {
    return this.request("POST", endpoint, body);
  }

  put(endpoint, body) {
    return this.request("PUT", endpoint, body);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
  console.log(`PASS: ${message}`);
}

function getDonations(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.donations)) return payload.data.donations;
  if (Array.isArray(payload?.donations)) return payload.donations;
  return [];
}

async function register(role, suffix) {
  const session = new ApiSession(role);
  const email = `demo.${role}.${suffix}@foodbridge.test`;
  const response = await session.post("/auth/register", {
    firstName: `Demo${role}`,
    lastName: "User",
    email,
    password: PASSWORD,
    role,
    city: "Bangalore",
    organization:
      role === "ngo"
        ? { name: `Demo NGO ${suffix}`, type: "ngo" }
        : role === "donor"
          ? { name: `Demo Donor Kitchen ${suffix}`, type: "restaurant" }
          : undefined,
  });
  session.user = response.data.user;
  assert(session.user?.role === role, `${role} account registered and logged in`);
  assert(Boolean(session.csrfToken), `${role} session has CSRF token`);
  return session;
}

async function main() {
  const suffix = `${Date.now()}`;
  console.log(`FoodBridge demo workflow smoke test`);
  console.log(`API: ${API_BASE}`);
  console.log(`Run id: ${suffix}\n`);

  const healthSession = new ApiSession("health");
  const health = await healthSession.get("/health");
  assert(health.success === true, "backend health endpoint is reachable");

  const donor = await register("donor", suffix);
  const ngo = await register("ngo", suffix);
  const volunteer = await register("volunteer", suffix);

  const pickupDatetime = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
  const created = await donor.post("/donations", {
    items: [
      {
        itemName: `Demo Rice ${suffix}`,
        category: "Cooked Food",
        quantity: "25",
        unit: "meals",
      },
    ],
    address: "MG Road Demo Kitchen",
    city: "Bangalore",
    state: "Karnataka",
    zip: "560001",
    lat: 12.9716,
    lng: 77.5946,
    pickupDatetime,
    priority: "critical",
    notes: `Demo workflow smoke test ${suffix}`,
  });
  const donationId = created.data?._id || created.data?.id;
  assert(Boolean(donationId), "donor can submit donation");
  assert(created.data.status === "pending", "new donation starts as pending");

  const publicBeforeClaim = getDonations(await healthSession.get("/donations/public-map"));
  assert(
    publicBeforeClaim.some((donation) => String(donation._id || donation.id) === donationId),
    "pending donation appears on public/live map feed",
  );

  const ngoAvailable = getDonations(await ngo.get("/donations/ngo/available"));
  assert(
    ngoAvailable.some((donation) => String(donation._id || donation.id) === donationId),
    "NGO can see donation as claimable",
  );

  await ngo.put(`/donations/${donationId}/claim`, {});
  const volunteerAvailable = getDonations(await volunteer.get("/donations/volunteer/available"));
  assert(
    volunteerAvailable.some((donation) => String(donation._id || donation.id) === donationId),
    "volunteer sees donation only after NGO claim",
  );

  await volunteer.put(`/donations/${donationId}/status`, { status: "accepted" });
  let volunteerRecords = getDonations(await volunteer.get("/donations"));
  let current = volunteerRecords.find((donation) => String(donation._id || donation.id) === donationId);
  assert(current?.status === "accepted", "volunteer can accept claimed donation");

  await volunteer.put(`/donations/${donationId}/status`, { status: "picked_up" });
  volunteerRecords = getDonations(await volunteer.get("/donations"));
  current = volunteerRecords.find((donation) => String(donation._id || donation.id) === donationId);
  assert(current?.status === "picked_up", "volunteer can mark donation picked up");

  await volunteer.put(`/donations/${donationId}/status`, { status: "delivered" });
  const ngoRecordsAfterDelivery = getDonations(await ngo.get("/donations"));
  current = ngoRecordsAfterDelivery.find((donation) => String(donation._id || donation.id) === donationId);
  assert(current?.status === "delivered", "NGO can see delivered claimed donation");

  await ngo.put(`/donations/${donationId}/status`, { status: "closed" });
  const ngoRecordsAfterClose = getDonations(await ngo.get("/donations"));
  current = ngoRecordsAfterClose.find((donation) => String(donation._id || donation.id) === donationId);
  assert(current?.status === "closed", "NGO can confirm receipt and close donation");

  const publicAfterClose = getDonations(await healthSession.get("/donations/public-map"));
  assert(
    !publicAfterClose.some((donation) => String(donation._id || donation.id) === donationId),
    "closed donation leaves active public/live map feed",
  );

  console.log("\nDEMO WORKFLOW RESULT: PASS");
  console.log(`Created donation: ${donationId}`);
  console.log(`Demo accounts password: ${PASSWORD}`);
  console.log(`Donor: ${donor.user.email || `demo.donor.${suffix}@foodbridge.test`}`);
  console.log(`NGO: demo.ngo.${suffix}@foodbridge.test`);
  console.log(`Volunteer: demo.volunteer.${suffix}@foodbridge.test`);
}

main().catch((error) => {
  console.error("\nDEMO WORKFLOW RESULT: FAIL");
  console.error(error.message);
  process.exit(1);
});
