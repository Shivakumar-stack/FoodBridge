/**
 * generate-csv-dataset.js
 * Generates realistic CSV files for all 12 MongoDB collections.
 * Each collection gets 55+ records with real Karnataka data (Jan–May 2026).
 * Usage: node scripts/generate-csv-dataset.js
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const OUT = path.resolve(__dirname, "..", "dataset");
const oid = () => crypto.randomBytes(12).toString("hex");
const pick = a => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const rDate = (s, e) => new Date(s.getTime() + Math.random() * (e.getTime() - s.getTime()));
const fmt = d => d.toISOString();
const esc = v => { const s = String(v ?? ""); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (headers, rows) => [headers.join(","), ...rows.map(r => r.map(esc).join(","))].join("\n");

const START = new Date("2026-01-05");
const END = new Date("2026-05-10");
const PW = "Password@123";

const CITIES = [
  {c:"Bangalore",s:"Karnataka",z:"560001",lat:12.9716,lng:77.5946},
  {c:"Mysore",s:"Karnataka",z:"570001",lat:12.2958,lng:76.6394},
  {c:"Hubli",s:"Karnataka",z:"580020",lat:15.3647,lng:75.1240},
  {c:"Mangalore",s:"Karnataka",z:"575001",lat:12.9141,lng:74.8560},
  {c:"Belgaum",s:"Karnataka",z:"590001",lat:15.8497,lng:74.4977},
  {c:"Davanagere",s:"Karnataka",z:"577001",lat:14.4644,lng:75.9218},
  {c:"Shimoga",s:"Karnataka",z:"577201",lat:13.9299,lng:75.5681},
  {c:"Udupi",s:"Karnataka",z:"576101",lat:13.3409,lng:74.7971},
  {c:"Gulbarga",s:"Karnataka",z:"585101",lat:17.3297,lng:76.8343},
  {c:"Raichur",s:"Karnataka",z:"584101",lat:16.2120,lng:77.3439},
];
const STREETS = ["MG Road","Brigade Road","Jayanagar 4th Block","Koramangala 5th Block","Rajajinagar 1st Block","Indiranagar 100ft Road","Whitefield Main Road","Electronic City Phase 1","HSR Layout Sector 2","Residency Road","Commercial Street","Race Course Road","Lalbagh Road","Bull Temple Road","Bannerghatta Road","Sarjapur Road","Hebbal Main Road","Peenya Industrial Area","Yeshwanthpur Circle","Malleshwaram 8th Cross","Basaveshwaranagar Main Road","Vijayanagar Club Road","Kengeri Main Road","Yelahanka New Town","JP Nagar 6th Phase"];

const FOOD = [
  {n:"Vegetable Biryani",c:"Cooked Food",u:"servings"},{n:"Chapati with Dal",c:"Cooked Food",u:"plates"},
  {n:"Sambar Rice",c:"Cooked Food",u:"servings"},{n:"Idli Vada Combo",c:"Cooked Food",u:"plates"},
  {n:"Pulao with Raita",c:"Cooked Food",u:"servings"},{n:"Curd Rice",c:"Cooked Food",u:"bowls"},
  {n:"Paneer Butter Masala",c:"Cooked Food",u:"servings"},{n:"Roti with Sabzi",c:"Cooked Food",u:"plates"},
  {n:"Rice Bags 5kg",c:"Raw Ingredients",u:"bags"},{n:"Wheat Flour 10kg",c:"Raw Ingredients",u:"bags"},
  {n:"Toor Dal 2kg",c:"Raw Ingredients",u:"packets"},{n:"Cooking Oil 5L",c:"Raw Ingredients",u:"cans"},
  {n:"Mixed Vegetables",c:"Vegetables",u:"kg"},{n:"Tomatoes",c:"Vegetables",u:"kg"},
  {n:"Onions",c:"Vegetables",u:"kg"},{n:"Potatoes",c:"Vegetables",u:"kg"},
  {n:"Bananas",c:"Fruits",u:"dozen"},{n:"Apples",c:"Fruits",u:"kg"},
  {n:"Milk Packets",c:"Dairy",u:"packets"},{n:"Paneer Blocks",c:"Dairy",u:"blocks"},
  {n:"Bread Loaves",c:"Baked Goods",u:"loaves"},{n:"Biscuit Packets",c:"Packaged",u:"packets"},
  {n:"Juice Tetra Packs",c:"Beverages",u:"packs"},{n:"Buttermilk 1L",c:"Beverages",u:"bottles"},
];

const FIRST = ["Ananya","Vikram","Priya","Suresh","Deepa","Karthik","Meenakshi","Abdul","Lakshmi","Naveen","Amit","Sneha","Rahul","Divya","Manoj","Arun","Kavita","Sanjay","Pooja","Ramesh","Nisha","Ganesh","Swathi","Harish","Meera","Rohit","Anjali","Prasad","Rekha","Vinay","Shilpa","Mohan","Geeta","Anil","Sunita","Ravi","Bhavna","Kishore","Padma","Santosh","Suma","Venkat","Lata","Mahesh","Usha","Praveen","Savita","Girish","Jyothi","Ashok","Mangala","Satish","Aruna","Dinesh","Vasudha","Nagaraj","Shobha","Murali","Pushpa","Prakash"];
const LAST = ["Sharma","Reddy","Nair","Gowda","Hegde","Rao","Iyer","Rasheed","Devi","Shetty","Patil","Kulkarni","Joshi","Bhat","Kumar","Patel","Naidu","Prasad","Menon","Gupta","Swamy","Acharya","Kamath","Pai","Shenoy","Ballal","Kudva","Mallya","Amin","Verma"];
const ORGS_DONOR = ["Taj West End","Radisson Blu","ITC Windsor","Leela Palace","MTR Foods","Cafe Coffee Day","Empire Restaurant","Vidyarthi Bhavan","Mavalli Tiffin Rooms","Airlines Hotel","Hotel Janardhan","Kamat Yatrinivas","Upahar Darshini","Nandhini Deluxe","Meghana Foods","Truffles","Corner House","Koshy's Restaurant","Toit Brewpub","Brahmin's Coffee Bar","Hotel Dwarka","Sangam Hotel","Royal Orchid","Citrus Hotel","Green Park Hotel","Hotel Pai Vista","Hotel Pai Comforts","The Gateway Hotel","Fortune JP Celestial","Lemon Tree Hotel"];
const ORGS_NGO = ["Akshaya Patra Foundation","Feeding India","Robin Hood Army Karnataka","Annapoorna Trust","Adamya Chetana","Iskcon Food Relief","Infosys Foundation","Wipro Cares","No Food Waste Bangalore","Roti Bank Karnataka","Food For All Trust","Bangalore Baptist Hospital Kitchen","Seva Cafe Bangalore","Namma Ooru Foundation","HelpAge India Karnataka","CRY Karnataka","Smile Foundation Bangalore","GiveIndia Karnataka","United Way Bangalore","Concern India Foundation"];
const VEHICLES = ["motorcycle","car","bicycle","auto-rickshaw","van"];

async function generate() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const hash = await bcrypt.hash(PW, 12);

  // ── USERS (60) ─────────────────────────────────────────────────────
  const users = [];
  // 1 admin
  users.push({ id: oid(), fn: "Rajesh", ln: "Kumar", email: "admin@foodbridge.org", role: "admin", phone: "+91 9845012345", org: "FoodBridge Admin", orgType: "other", ci: 0 });
  // 20 donors
  for (let i = 0; i < 20; i++) {
    const fn = FIRST[i]; const ln = pick(LAST);
    users.push({ id: oid(), fn, ln, email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@gmail.com`, role: "donor", phone: `+91 ${rand(7000000000,9999999999)}`, org: pick(ORGS_DONOR), orgType: pick(["hotel","restaurant","corporate","caterer"]), ci: i % CITIES.length });
  }
  // 15 NGOs
  for (let i = 0; i < 15; i++) {
    const fn = FIRST[20+i]; const ln = pick(LAST);
    users.push({ id: oid(), fn, ln, email: `${fn.toLowerCase()}@${ORGS_NGO[i].toLowerCase().replace(/\s+/g,"")}.org`, role: "ngo", phone: `+91 ${rand(7000000000,9999999999)}`, org: ORGS_NGO[i], orgType: "ngo", ci: i % CITIES.length });
  }
  // 24 volunteers
  for (let i = 0; i < 24; i++) {
    const fn = FIRST[35+Math.min(i,FIRST.length-36)]; const ln = pick(LAST);
    users.push({ id: oid(), fn, ln, email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@gmail.com`, role: "volunteer", phone: `+91 ${rand(7000000000,9999999999)}`, org: "", orgType: "", ci: i % CITIES.length, vehicle: pick(VEHICLES) });
  }

  const uRows = users.map(u => {
    const loc = CITIES[u.ci];
    const cr = rDate(new Date("2025-10-01"), new Date("2026-01-20"));
    return [u.id, `${u.fn} ${u.ln}`, u.fn, u.ln, u.email, hash, u.phone, u.role, loc.c, loc.s, "active", u.org, u.orgType, u.vehicle || "", fmt(cr)];
  });
  fs.writeFileSync(path.join(OUT, "users.csv"), csv(["_id","name","firstName","lastName","email","password","phone","role","city","state","status","organizationName","organizationType","vehicleType","createdAt"], uRows));
  console.log(`  ✔ users.csv               → ${uRows.length} records`);


  const donors = users.filter(u => u.role === "donor");
  const ngos = users.filter(u => u.role === "ngo");
  const vols = users.filter(u => u.role === "volunteer");

  // ── VOLUNTEERS (same 24 volunteer users, separate collection) ──────
  const volRows = vols.map((v) => {
    const loc = CITIES[v.ci];
    return [oid(), v.id, `${v.fn} ${v.ln}`, v.email, v.phone, v.vehicle || pick(VEHICLES), loc.c, "true", rand(3, 55), (4 + Math.random()).toFixed(1), fmt(rDate(new Date("2025-11-01"), new Date("2026-02-01")))];
  });
  // pad to 55+
  while (volRows.length < 55) {
    const fn = pick(FIRST); const ln = pick(LAST); const loc = pick(CITIES);
    volRows.push([oid(), oid(), `${fn} ${ln}`, `${fn.toLowerCase()}.vol${volRows.length}@gmail.com`, `+91 ${rand(7000000000,9999999999)}`, pick(VEHICLES), loc.c, pick(["true","false"]), rand(0,30), (3.5+Math.random()*1.5).toFixed(1), fmt(rDate(START,END))]);
  }
  fs.writeFileSync(path.join(OUT, "volunteers.csv"), csv(["_id","userId","name","email","phone","vehicleType","city","isAvailable","completedPickups","rating","createdAt"], volRows));
  console.log(`  ✔ volunteers.csv          → ${volRows.length} records`);

  // ── MEALSERVERS (55+) ─────────────────────────────────────────────
  const msRows = [];
  for (let i = 0; i < 55; i++) {
    const ngo = ngos[i % ngos.length]; const loc = CITIES[i % CITIES.length];
    const orgName = i < ORGS_NGO.length ? ORGS_NGO[i] : `${pick(["Community","Hope","Nourish","Care","Life"])} ${pick(["Kitchen","Center","Hub","Foundation"])} ${loc.c}`;
    msRows.push([oid(), ngo.id, orgName, `${pick(FIRST)} ${pick(LAST)}`, `+91 ${rand(7000000000,9999999999)}`, loc.c, (loc.lat+(Math.random()-0.5)*0.04).toFixed(4), (loc.lng+(Math.random()-0.5)*0.04).toFixed(4), `${pick(STREETS)} ${loc.c}`, rand(100,1500), rand(30,500), "08:00", "20:00", "true", fmt(rDate(new Date("2025-10-01"), END))]);
  }
  fs.writeFileSync(path.join(OUT, "mealservers.csv"), csv(["_id","ngoId","organization_name","contact_person","phone","city","lat","lng","address","capacity","mealsServedDaily","openTime","closeTime","active","createdAt"], msRows));
  console.log(`  ✔ mealservers.csv         → ${msRows.length} records`);

  // ── DONATIONS (65) ─────────────────────────────────────────────────
  const statuses = ["pending","broadcasted","claimed","accepted","picked_up","in_transit","delivered","closed","completed","cancelled"];
  const statusDist = [
    ...Array(6).fill("pending"), ...Array(5).fill("broadcasted"), ...Array(6).fill("claimed"),
    ...Array(6).fill("accepted"), ...Array(5).fill("picked_up"), ...Array(4).fill("in_transit"),
    ...Array(10).fill("delivered"), ...Array(10).fill("closed"), ...Array(6).fill("completed"),
    ...Array(7).fill("cancelled"),
  ];
  const donationIds = [];
  const donRows = [];
  for (let i = 0; i < 65; i++) {
    const d = pick(donors); const loc = CITIES[d.ci];
    const did = oid(); donationIds.push(did);
    const st = statusDist[i] || pick(statuses);
    const cr = rDate(START, END);
    const pu = new Date(cr.getTime() + rand(2,48)*3600000);
    const fd = pick(FOOD);
    donRows.push([did, d.id, d.org || `${d.fn} ${d.ln}`, pick(STREETS), loc.c, loc.s, loc.z, st, pick(["low","medium","high","critical"]), pick(["Please collect before evening","Freshly prepared today","Stored in refrigerator","Available at back entrance","Call before arriving","Vegetarian only","Non-veg included","Extra packaging provided",""]),
      fd.n, fd.c, rand(5,80), fd.u, (loc.lat+(Math.random()-0.5)*0.04).toFixed(4), (loc.lng+(Math.random()-0.5)*0.04).toFixed(4), fmt(pu), fmt(cr)]);
  }
  fs.writeFileSync(path.join(OUT, "donations.csv"), csv(["_id","donorId","donorName","address","city","state","zip","status","priority","notes","itemName","category","quantity","unit","lat","lng","pickupDatetime","createdAt"], donRows));
  console.log(`  ✔ donations.csv           → ${donRows.length} records`);

  // ── CLAIMS (60) ────────────────────────────────────────────────────
  const claimableIdx = donRows.map((r,i) => i).filter(i => ["claimed","accepted","picked_up","in_transit","delivered","closed","completed"].includes(donRows[i][7]));
  const claimRows = [];
  for (let i = 0; i < Math.max(60, claimableIdx.length); i++) {
    const di = claimableIdx[i % claimableIdx.length];
    const ngo = pick(ngos);
    const cr = rDate(START, END);
    claimRows.push([oid(), donRows[di][0], ngo.id, pick(["pending","approved","approved","approved","rejected"]), fmt(cr), pick(["Needs urgent pickup","Standard claim","High priority area","Will distribute tomorrow",""]), fmt(cr)]);
  }
  fs.writeFileSync(path.join(OUT, "claims.csv"), csv(["_id","donation","ngo","status","claimedAt","notes","createdAt"], claimRows));
  console.log(`  ✔ claims.csv              → ${claimRows.length} records`);

  // ── LOGISTICS (60) ─────────────────────────────────────────────────
  const logStatuses = ["pending_assignment","assigned","in_progress","delivered","failed","cancelled"];
  const logRows = [];
  for (let i = 0; i < 60; i++) {
    const di = i % donRows.length;
    const d = donRows[di]; const donor = pick(donors); const ngo = pick(ngos); const vol = pick(vols);
    const cr = rDate(START, END);
    const ls = pick(logStatuses);
    logRows.push([oid(), `LOG-${Date.now()}-${rand(1000,9999)}`, d[0], donor.id, vol.id, ngo.id, ls, fmt(new Date(cr.getTime()+rand(1,12)*3600000)), ls==="delivered"?fmt(new Date(cr.getTime()+rand(13,36)*3600000)):"", pick(["Pickup from main gate","Use service entrance","Call on arrival","Fragile items","Standard pickup","Express delivery",""]), fmt(cr)]);
  }
  fs.writeFileSync(path.join(OUT, "logistics.csv"), csv(["_id","logisticsId","donation","donor","volunteer","ngo","status","pickupTime","deliveryTime","notes","createdAt"], logRows));
  console.log(`  ✔ logistics.csv           → ${logRows.length} records`);

  // ── DELIVERIES (60) ────────────────────────────────────────────────
  const delRows = [];
  for (let i = 0; i < 60; i++) {
    const di = i % donRows.length; const vol = pick(vols);
    const cr = rDate(START, END);
    delRows.push([oid(), donRows[di][0], vol.id, `${vol.fn} ${vol.ln}`, pick(["scheduled","in_transit","delivered","delivered","delivered","failed"]), fmt(new Date(cr.getTime()+rand(4,24)*3600000)), pick(["Delivered to shelter","Left at reception","Handed to coordinator","Delivered successfully","Partial delivery",""]), pick(CITIES).c, fmt(cr)]);
  }
  fs.writeFileSync(path.join(OUT, "deliveries.csv"), csv(["_id","donation","volunteerId","volunteerName","status","deliveryTime","notes","city","createdAt"], delRows));
  console.log(`  ✔ deliveries.csv          → ${delRows.length} records`);

  // ── PICKUPS (60) ───────────────────────────────────────────────────
  const pkRows = [];
  for (let i = 0; i < 60; i++) {
    const di = i % donRows.length; const vol = pick(vols);
    const cr = rDate(START, END);
    pkRows.push([oid(), donRows[di][0], vol.id, `${vol.fn} ${vol.ln}`, pick(["scheduled","en_route","picked_up","picked_up","picked_up","cancelled"]), fmt(new Date(cr.getTime()+rand(1,12)*3600000)), pick(["On time","Slight delay due to traffic","Picked up successfully","Donor not available - rescheduled","Items in good condition",""]), pick(CITIES).c, fmt(cr)]);
  }
  fs.writeFileSync(path.join(OUT, "pickups.csv"), csv(["_id","donation","volunteerId","volunteerName","status","pickupTime","notes","city","createdAt"], pkRows));
  console.log(`  ✔ pickups.csv             → ${pkRows.length} records`);

  // ── NOTIFICATIONS (70) ─────────────────────────────────────────────
  const notifTypes = ["info","success","warning","error","status_update","pickup","delivery","donation","alert","assignment"];
  const notifRows = [];
  for (let i = 0; i < 70; i++) {
    const u = pick(users); const cr = rDate(START, END);
    const t = pick(notifTypes);
    const titles = { info:"System Update", success:"Action Completed", warning:"Attention Required", error:"Error Occurred", status_update:"Donation Status Changed", pickup:"Pickup Scheduled", delivery:"Delivery Update", donation:"New Donation", alert:"Urgent Alert", assignment:"New Assignment" };
    const msgs = { info:"Your dashboard has been updated with latest metrics.", success:"Your donation has been successfully processed.", warning:"A donation near you is expiring soon - please check.", error:"Failed to process your last request. Please retry.", status_update:`Donation status changed to ${pick(statuses)}.`, pickup:"A volunteer has been assigned for pickup.", delivery:"Your donation has been delivered successfully.", donation:"A new donation matching your area is available.", alert:"Critical: Multiple donations expiring within 2 hours.", assignment:"You have been assigned a new pickup task." };
    notifRows.push([oid(), u.id, titles[t], msgs[t], t, pick(["true","true","false"]), fmt(cr)]);
  }
  fs.writeFileSync(path.join(OUT, "notifications.csv"), csv(["_id","user","title","message","type","isRead","createdAt"], notifRows));
  console.log(`  ✔ notifications.csv       → ${notifRows.length} records`);

  // ── INVENTORYLOGS (60) ─────────────────────────────────────────────
  const invRows = [];
  for (let i = 0; i < 60; i++) {
    const ngo = pick(ngos); const loc = CITIES[ngo.ci]; const fd = pick(FOOD);
    const cr = rDate(START, END);
    invRows.push([oid(), pick(msRows)[0], donationIds[i % donationIds.length], fd.n, fd.c, rand(5,100), fd.u, pick(["received","consumed","spoiled","transferred"]), ngo.id, loc.c, pick(["Regular intake","Monthly stock","Emergency supply","Transferred to branch","Consumed for daily meals","Spoiled due to delay",""]), fmt(cr)]);
  }
  fs.writeFileSync(path.join(OUT, "inventorylogs.csv"), csv(["_id","mealServer","donationId","itemName","category","quantity","unit","operationType","loggedBy","city","notes","createdAt"], invRows));
  console.log(`  ✔ inventorylogs.csv       → ${invRows.length} records`);

  // ── CONTACTS (55) ──────────────────────────────────────────────────
  const contactSubjects = ["Volunteer Inquiry","Partnership Proposal","Donation Question","Feedback","Food Safety Concern","Delivery Issue","General Inquiry","Media Inquiry","Corporate Partnership","Technical Support"];
  const contRows = [];
  for (let i = 0; i < 55; i++) {
    const fn = pick(FIRST); const ln = pick(LAST); const cr = rDate(START, END);
    const subj = pick(contactSubjects);
    const msgMap = { "Volunteer Inquiry":"I would like to volunteer for food delivery in my area.","Partnership Proposal":"Our organization is interested in partnering with FoodBridge.","Donation Question":"How do I schedule a recurring donation pickup?","Feedback":"Great platform! The live map feature is very helpful.","Food Safety Concern":"What temperature controls are used during transport?","Delivery Issue":"My last delivery was delayed by 3 hours.","General Inquiry":"What areas does FoodBridge currently serve in Karnataka?","Media Inquiry":"We are writing an article about food waste reduction initiatives.","Corporate Partnership":"Our company wants to donate surplus cafeteria food daily.","Technical Support":"I cannot update my profile information on the dashboard." };
    const tp = subj.includes("Volunteer") ? "volunteer_inquiry" : subj.includes("Partner") ? "partnership" : "general";
    contRows.push([oid(), `${fn} ${ln}`, `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@gmail.com`, subj, msgMap[subj] || "General inquiry about FoodBridge services.", tp, pick(["new","read","replied","resolved"]), fmt(cr)]);
  }
  fs.writeFileSync(path.join(OUT, "contacts.csv"), csv(["_id","name","email","subject","message","type","status","createdAt"], contRows));
  console.log(`  ✔ contacts.csv            → ${contRows.length} records`);

  // ── REQUESTS (58) ──────────────────────────────────────────────────
  const reqRows = [];
  for (let i = 0; i < 58; i++) {
    const ngo = pick(ngos); const loc = CITIES[ngo.ci]; const cr = rDate(START, END);
    const foods = ["Rice and Dal","Chapati and vegetables","Cooked meals for 50","Breakfast items","Mixed food packages","Fruits and milk","Bread and biscuits","Complete thali meals","Baby food and milk","Protein-rich meals"];
    reqRows.push([oid(), ngo.id, ngo.org, pick(foods), `${rand(20,300)} servings`, `${pick(STREETS)} ${loc.c}`, pick(["low","medium","high","critical"]), pick(["pending","pending","approved","fulfilled","fulfilled","rejected"]), pick(["For shelter residents","School lunch program","Daily distribution","Emergency relief","Old age home","Orphanage meals","Street children feeding","Community kitchen",""]), fmt(cr)]);
  }
  fs.writeFileSync(path.join(OUT, "requests.csv"), csv(["_id","ngoId","ngoName","foodNeeded","quantity","location","urgency","status","notes","createdAt"], reqRows));
  console.log(`  ✔ requests.csv            → ${reqRows.length} records`);

  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`  ALL 12 CSV FILES WRITTEN TO: ${OUT}`);
  console.log(`  Password for ALL user accounts: ${PW}`);
  console.log(`══════════════════════════════════════════════════\n`);
}

generate().catch(e => { console.error("Failed:", e); process.exit(1); });
