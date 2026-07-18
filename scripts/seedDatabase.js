const mongoose = require("mongoose");
const dns = require("dns");
const User = require("../backend/models/User");
const Donation = require("../backend/models/Donation");
const Logistics = require("../backend/models/Logistics");
const Request = require("../backend/models/Request");
require("dotenv").config();

try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch (_error) {
  // Ignore DNS override failures and allow the native resolver to proceed.
}

// Helper: date N days ago at a specific hour
function daysAgo(n, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
  return d;
}

async function seedDatabase() {
  try {
    console.log("🔗 Connecting to MongoDB...");
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(uri);
    console.log("✅ Connected.\n");

    // ── CLEAR ALL DATA ──
    console.log("🗑️  Clearing ALL existing data...");
    await Promise.all([
      User.deleteMany({}),
      Donation.deleteMany({}),
      Logistics.deleteMany({}),
      Request.deleteMany({}),
    ]);
    console.log("✅ All collections cleared.\n");

    // ── CREATE USERS ──
    console.log("👥 Creating users...");
    const pw = "password123";

    await User.create({
      name: "System Admin", firstName: "System", lastName: "Admin",
      email: "admin@foodbridge.com", password: pw, role: "admin",
      phone: "9000000001", city: "Bangalore",
    });

    const donors = await User.create([
      { name: "Taj Hotels Catering", firstName: "Taj", lastName: "Hotels", email: "donor1@foodbridge.com", password: pw, role: "donor", phone: "9876543210", city: "Bangalore", organization: { name: "Taj Hotels Catering" } },
      { name: "Rahul Sharma", firstName: "Rahul", lastName: "Sharma", email: "donor2@foodbridge.com", password: pw, role: "donor", phone: "9876543211", city: "Mysore" },
      { name: "ITC Grand Kitchen", firstName: "ITC", lastName: "Grand", email: "donor3@foodbridge.com", password: pw, role: "donor", phone: "9876543214", city: "Bangalore", organization: { name: "ITC Hotels" } },
      { name: "Annapurna Caterers", firstName: "Annapurna", lastName: "Caterers", email: "donor4@foodbridge.com", password: pw, role: "donor", phone: "9876543215", city: "Chennai", organization: { name: "Annapurna Caterers" } },
      { name: "Priya Mehta", firstName: "Priya", lastName: "Mehta", email: "donor5@foodbridge.com", password: pw, role: "donor", phone: "9876543216", city: "Hyderabad" },
      { name: "Oberoi Banquets", firstName: "Oberoi", lastName: "Banquets", email: "donor6@foodbridge.com", password: pw, role: "donor", phone: "9876543217", city: "Bangalore", organization: { name: "Oberoi Group" } },
    ]);

    const ngos = await User.create([
      { name: "Hope Foundation", firstName: "Hope", lastName: "Foundation", email: "ngo1@foodbridge.com", password: pw, role: "ngo", phone: "9876543212", city: "Bangalore", organization: { name: "Hope Foundation" } },
      { name: "Akshaya Patra", firstName: "Akshaya", lastName: "Patra", email: "ngo2@foodbridge.com", password: pw, role: "ngo", phone: "9876543218", city: "Mysore", organization: { name: "Akshaya Patra Foundation" } },
      { name: "Feeding India", firstName: "Feeding", lastName: "India", email: "ngo3@foodbridge.com", password: pw, role: "ngo", phone: "9876543219", city: "Chennai", organization: { name: "Feeding India" } },
    ]);

    const volunteers = await User.create([
      { name: "Amit Kumar", firstName: "Amit", lastName: "Kumar", email: "volunteer1@foodbridge.com", password: pw, role: "volunteer", phone: "9876543213", city: "Bangalore" },
      { name: "Sneha Rao", firstName: "Sneha", lastName: "Rao", email: "volunteer2@foodbridge.com", password: pw, role: "volunteer", phone: "9876543220", city: "Mysore" },
      { name: "Vikram Singh", firstName: "Vikram", lastName: "Singh", email: "volunteer3@foodbridge.com", password: pw, role: "volunteer", phone: "9876543221", city: "Bangalore" },
      { name: "Deepa Nair", firstName: "Deepa", lastName: "Nair", email: "volunteer4@foodbridge.com", password: pw, role: "volunteer", phone: "9876543222", city: "Chennai" },
    ]);

    console.log(`   Created: 1 admin, ${donors.length} donors, ${ngos.length} NGOs, ${volunteers.length} volunteers\n`);

    // ── DONATION TEMPLATES ──
    // Spread across 7 days for a beautiful ascending weekly graph
    // Target pattern: Mon=3, Tue=5, Wed=4, Thu=7, Fri=6, Sat=8, Sun=5 (today)
    const donationTemplates = [
      // ── Days 7 to 14 ago (Older Data for Chart) ──
      { donor: 0, name: "Taj Hotels Catering", item: "Pastries Box", cat: "Baked Goods", qty: "5", unit: "kg", srv: 50, city: "Bangalore", addr: "MG Road, Bangalore", st: "Karnataka", zip: "560001", lat: 12.9716, lng: 77.5946, status: "completed", day: 14, hr: 8, priority: "low" },
      { donor: 1, name: "Rahul Sharma", item: "Rice bags", cat: "Raw Ingredients", qty: "20", unit: "kg", srv: 100, city: "Mysore", addr: "Gokulam Main Rd, Mysore", st: "Karnataka", zip: "570002", lat: 12.3051, lng: 76.6551, status: "completed", day: 12, hr: 14, priority: "medium" },
      { donor: 2, name: "ITC Grand Kitchen", item: "Dal Makhani", cat: "Cooked Food", qty: "15", unit: "kg", srv: 120, city: "Bangalore", addr: "Whitefield, Bangalore", st: "Karnataka", zip: "560066", lat: 12.9698, lng: 77.7500, status: "completed", day: 9, hr: 16, priority: "high" },
      { donor: 3, name: "Annapurna Caterers", item: "Sweets & Savories", cat: "Packaged", qty: "30", unit: "kg", srv: 150, city: "Chennai", addr: "T Nagar, Chennai", st: "Tamil Nadu", zip: "600017", lat: 13.0418, lng: 80.2341, status: "completed", day: 7, hr: 11, priority: "medium" },

      // ── Day 6 ago (Mon) — 3 donations ──
      { donor: 0, name: "Taj Hotels Catering", item: "Vegetable Biryani", cat: "Cooked Food", qty: "25", unit: "kg", srv: 200, city: "Bangalore", addr: "MG Road, Bangalore", st: "Karnataka", zip: "560001", lat: 12.9716, lng: 77.5946, status: "completed", day: 6, hr: 9, priority: "high" },
      { donor: 1, name: "Rahul Sharma", item: "Fresh Fruits Basket", cat: "Fruits", qty: "15", unit: "kg", srv: 120, city: "Mysore", addr: "Gokulam Main Rd, Mysore", st: "Karnataka", zip: "570002", lat: 12.3051, lng: 76.6551, status: "completed", day: 6, hr: 12, priority: "medium" },
      { donor: 2, name: "ITC Grand Kitchen", item: "Paneer Butter Masala", cat: "Cooked Food", qty: "20", unit: "kg", srv: 160, city: "Bangalore", addr: "Whitefield, Bangalore", st: "Karnataka", zip: "560066", lat: 12.9698, lng: 77.7500, status: "delivered", day: 6, hr: 15, priority: "high" },

      // ── Day 5 ago (Tue) — 5 donations ──
      { donor: 3, name: "Annapurna Caterers", item: "Sambar Rice", cat: "Cooked Food", qty: "40", unit: "kg", srv: 320, city: "Chennai", addr: "T Nagar, Chennai", st: "Tamil Nadu", zip: "600017", lat: 13.0418, lng: 80.2341, status: "completed", day: 5, hr: 8, priority: "high" },
      { donor: 0, name: "Taj Hotels Catering", item: "Assorted Sandwiches", cat: "Packaged", qty: "100", unit: "pcs", srv: 100, city: "Bangalore", addr: "MG Road, Bangalore", st: "Karnataka", zip: "560001", lat: 12.9716, lng: 77.5946, status: "completed", day: 5, hr: 10, priority: "medium" },
      { donor: 4, name: "Priya Mehta", item: "Chapati & Dal", cat: "Cooked Food", qty: "30", unit: "kg", srv: 250, city: "Hyderabad", addr: "Banjara Hills, Hyderabad", st: "Telangana", zip: "500034", lat: 17.4156, lng: 78.4347, status: "delivered", day: 5, hr: 13, priority: "medium" },
      { donor: 5, name: "Oberoi Banquets", item: "Wedding Buffet Surplus", cat: "Cooked Food", qty: "60", unit: "kg", srv: 500, city: "Bangalore", addr: "Koramangala, Bangalore", st: "Karnataka", zip: "560034", lat: 12.9352, lng: 77.6245, status: "completed", day: 5, hr: 16, priority: "critical" },
      { donor: 1, name: "Rahul Sharma", item: "Organic Vegetables", cat: "Vegetables", qty: "12", unit: "kg", srv: 90, city: "Mysore", addr: "VV Mohalla, Mysore", st: "Karnataka", zip: "570002", lat: 12.3051, lng: 76.6551, status: "completed", day: 5, hr: 18, priority: "low" },

      // ── Day 4 ago (Wed) — 4 donations ──
      { donor: 2, name: "ITC Grand Kitchen", item: "Curd Rice & Pickle", cat: "Cooked Food", qty: "35", unit: "kg", srv: 280, city: "Bangalore", addr: "Indiranagar, Bangalore", st: "Karnataka", zip: "560038", lat: 12.9784, lng: 77.6408, status: "completed", day: 4, hr: 9, priority: "high" },
      { donor: 3, name: "Annapurna Caterers", item: "Idli & Chutney", cat: "Cooked Food", qty: "200", unit: "pcs", srv: 200, city: "Chennai", addr: "Mylapore, Chennai", st: "Tamil Nadu", zip: "600004", lat: 13.0368, lng: 80.2676, status: "delivered", day: 4, hr: 11, priority: "medium" },
      { donor: 0, name: "Taj Hotels Catering", item: "Fresh Baked Bread", cat: "Baked Goods", qty: "50", unit: "pcs", srv: 50, city: "Bangalore", addr: "MG Road, Bangalore", st: "Karnataka", zip: "560001", lat: 12.9716, lng: 77.5946, status: "completed", day: 4, hr: 14, priority: "low" },
      { donor: 4, name: "Priya Mehta", item: "Mixed Fruit Juice", cat: "Beverages", qty: "20", unit: "liters", srv: 80, city: "Hyderabad", addr: "Jubilee Hills, Hyderabad", st: "Telangana", zip: "500033", lat: 17.4319, lng: 78.4073, status: "completed", day: 4, hr: 17, priority: "medium" },

      // ── Day 3 ago (Thu) — 7 donations ──
      { donor: 5, name: "Oberoi Banquets", item: "Pasta & Garlic Bread", cat: "Cooked Food", qty: "30", unit: "kg", srv: 240, city: "Bangalore", addr: "JP Nagar, Bangalore", st: "Karnataka", zip: "560078", lat: 12.9063, lng: 77.5857, status: "completed", day: 3, hr: 7, priority: "high" },
      { donor: 0, name: "Taj Hotels Catering", item: "Fried Rice Combo", cat: "Cooked Food", qty: "45", unit: "kg", srv: 360, city: "Bangalore", addr: "MG Road, Bangalore", st: "Karnataka", zip: "560001", lat: 12.9716, lng: 77.5946, status: "completed", day: 3, hr: 9, priority: "critical" },
      { donor: 1, name: "Rahul Sharma", item: "Banana Bunches", cat: "Fruits", qty: "20", unit: "kg", srv: 100, city: "Mysore", addr: "Jayalakshmipuram, Mysore", st: "Karnataka", zip: "570012", lat: 12.3151, lng: 76.6451, status: "delivered", day: 3, hr: 10, priority: "low" },
      { donor: 2, name: "ITC Grand Kitchen", item: "Naan & Butter Chicken", cat: "Cooked Food", qty: "25", unit: "kg", srv: 200, city: "Bangalore", addr: "Whitefield, Bangalore", st: "Karnataka", zip: "560066", lat: 12.9698, lng: 77.7500, status: "completed", day: 3, hr: 12, priority: "high" },
      { donor: 3, name: "Annapurna Caterers", item: "Dosa Batter", cat: "Raw Ingredients", qty: "15", unit: "kg", srv: 150, city: "Chennai", addr: "Anna Nagar, Chennai", st: "Tamil Nadu", zip: "600040", lat: 13.0850, lng: 80.2101, status: "completed", day: 3, hr: 14, priority: "medium" },
      { donor: 4, name: "Priya Mehta", item: "Milk Packets", cat: "Dairy", qty: "50", unit: "liters", srv: 200, city: "Hyderabad", addr: "Begumpet, Hyderabad", st: "Telangana", zip: "500016", lat: 17.4440, lng: 78.4674, status: "completed", day: 3, hr: 16, priority: "medium" },
      { donor: 5, name: "Oberoi Banquets", item: "Veg Pulao & Raita", cat: "Cooked Food", qty: "35", unit: "kg", srv: 280, city: "Bangalore", addr: "Koramangala, Bangalore", st: "Karnataka", zip: "560034", lat: 12.9352, lng: 77.6245, status: "delivered", day: 3, hr: 19, priority: "high" },

      // ── Day 2 ago (Fri) — 6 donations ──
      { donor: 0, name: "Taj Hotels Catering", item: "Pav Bhaji", cat: "Cooked Food", qty: "30", unit: "kg", srv: 240, city: "Bangalore", addr: "MG Road, Bangalore", st: "Karnataka", zip: "560001", lat: 12.9716, lng: 77.5946, status: "completed", day: 2, hr: 8, priority: "high" },
      { donor: 2, name: "ITC Grand Kitchen", item: "Spring Rolls & Manchurian", cat: "Cooked Food", qty: "20", unit: "kg", srv: 160, city: "Bangalore", addr: "Electronic City, Bangalore", st: "Karnataka", zip: "560100", lat: 12.8440, lng: 77.6568, status: "completed", day: 2, hr: 10, priority: "medium" },
      { donor: 1, name: "Rahul Sharma", item: "Watermelon Slices", cat: "Fruits", qty: "25", unit: "kg", srv: 100, city: "Mysore", addr: "Saraswathipuram, Mysore", st: "Karnataka", zip: "570009", lat: 12.3201, lng: 76.6601, status: "delivered", day: 2, hr: 11, priority: "low" },
      { donor: 3, name: "Annapurna Caterers", item: "Lemon Rice & Curd Rice", cat: "Cooked Food", qty: "50", unit: "kg", srv: 400, city: "Chennai", addr: "Adyar, Chennai", st: "Tamil Nadu", zip: "600020", lat: 13.0067, lng: 80.2575, status: "completed", day: 2, hr: 14, priority: "critical" },
      { donor: 5, name: "Oberoi Banquets", item: "Conference Lunch Surplus", cat: "Cooked Food", qty: "40", unit: "kg", srv: 320, city: "Bangalore", addr: "HSR Layout, Bangalore", st: "Karnataka", zip: "560102", lat: 12.9116, lng: 77.6474, status: "completed", day: 2, hr: 16, priority: "high" },
      { donor: 4, name: "Priya Mehta", item: "Biscuit Packets", cat: "Packaged", qty: "200", unit: "pcs", srv: 200, city: "Hyderabad", addr: "Madhapur, Hyderabad", st: "Telangana", zip: "500081", lat: 17.4484, lng: 78.3908, status: "claimed", day: 2, hr: 18, priority: "medium" },

      // ── Day 1 ago (Sat) — 8 donations ──
      { donor: 0, name: "Taj Hotels Catering", item: "Chicken Biryani", cat: "Cooked Food", qty: "60", unit: "kg", srv: 480, city: "Bangalore", addr: "MG Road, Bangalore", st: "Karnataka", zip: "560001", lat: 12.9716, lng: 77.5946, status: "completed", day: 1, hr: 7, priority: "critical" },
      { donor: 2, name: "ITC Grand Kitchen", item: "Chole Bhature", cat: "Cooked Food", qty: "30", unit: "kg", srv: 240, city: "Bangalore", addr: "Jayanagar, Bangalore", st: "Karnataka", zip: "560041", lat: 12.9250, lng: 77.5938, status: "delivered", day: 1, hr: 9, priority: "high" },
      { donor: 3, name: "Annapurna Caterers", item: "Pongal & Vada", cat: "Cooked Food", qty: "40", unit: "kg", srv: 320, city: "Chennai", addr: "Velachery, Chennai", st: "Tamil Nadu", zip: "600042", lat: 12.9815, lng: 80.2180, status: "completed", day: 1, hr: 10, priority: "high" },
      { donor: 5, name: "Oberoi Banquets", item: "Party Snacks Platter", cat: "Packaged", qty: "150", unit: "pcs", srv: 150, city: "Bangalore", addr: "Malleshwaram, Bangalore", st: "Karnataka", zip: "560003", lat: 13.0035, lng: 77.5710, status: "completed", day: 1, hr: 11, priority: "medium" },
      { donor: 1, name: "Rahul Sharma", item: "Mango Pulp Cans", cat: "Packaged", qty: "30", unit: "pcs", srv: 120, city: "Mysore", addr: "Hebbal, Mysore", st: "Karnataka", zip: "570016", lat: 12.3651, lng: 76.6351, status: "completed", day: 1, hr: 13, priority: "low" },
      { donor: 4, name: "Priya Mehta", item: "Khichdi & Papad", cat: "Cooked Food", qty: "20", unit: "kg", srv: 160, city: "Hyderabad", addr: "Gachibowli, Hyderabad", st: "Telangana", zip: "500032", lat: 17.4401, lng: 78.3489, status: "delivered", day: 1, hr: 15, priority: "medium" },
      { donor: 0, name: "Taj Hotels Catering", item: "Dessert Tray - Gulab Jamun", cat: "Cooked Food", qty: "10", unit: "kg", srv: 100, city: "Bangalore", addr: "MG Road, Bangalore", st: "Karnataka", zip: "560001", lat: 12.9716, lng: 77.5946, status: "completed", day: 1, hr: 17, priority: "low" },
      { donor: 2, name: "ITC Grand Kitchen", item: "Fresh Salad Bowl", cat: "Vegetables", qty: "15", unit: "kg", srv: 60, city: "Bangalore", addr: "Yelahanka, Bangalore", st: "Karnataka", zip: "560064", lat: 13.1007, lng: 77.5963, status: "claimed", day: 1, hr: 19, priority: "medium" },

      // ── Today (Sun) — Active & Pending Data ──
      { donor: 5, name: "Oberoi Banquets", item: "Sunday Brunch Surplus", cat: "Cooked Food", qty: "50", unit: "kg", srv: 400, city: "Bangalore", addr: "Koramangala, Bangalore", st: "Karnataka", zip: "560034", lat: 12.9352, lng: 77.6245, status: "in_transit", day: 0, hr: 8, priority: "critical" },
      { donor: 0, name: "Taj Hotels Catering", item: "Mixed Veg Curry", cat: "Cooked Food", qty: "35", unit: "kg", srv: 280, city: "Bangalore", addr: "MG Road, Bangalore", st: "Karnataka", zip: "560001", lat: 12.9716, lng: 77.5946, status: "pending", day: 0, hr: 10, priority: "high" },
      { donor: 3, name: "Annapurna Caterers", item: "Upma & Kesari Bath", cat: "Cooked Food", qty: "25", unit: "kg", srv: 200, city: "Chennai", addr: "T Nagar, Chennai", st: "Tamil Nadu", zip: "600017", lat: 13.0418, lng: 80.2341, status: "pending", day: 0, hr: 12, priority: "medium" },
      { donor: 1, name: "Rahul Sharma", item: "Coconut Water Bottles", cat: "Beverages", qty: "50", unit: "pcs", srv: 50, city: "Mysore", addr: "Gokulam, Mysore", st: "Karnataka", zip: "570002", lat: 12.3051, lng: 76.6551, status: "picked_up", day: 0, hr: 14, priority: "low" },
      { donor: 4, name: "Priya Mehta", item: "Rajma Chawal", cat: "Cooked Food", qty: "20", unit: "kg", srv: 160, city: "Hyderabad", addr: "HITEC City, Hyderabad", st: "Telangana", zip: "500081", lat: 17.4484, lng: 78.3908, status: "pending", day: 0, hr: 16, priority: "high" },
    ];

    console.log(`🍱 Creating ${donationTemplates.length} donations across 14 days...`);

    const createdDonations = [];
    for (const t of donationTemplates) {
      const createdAt = daysAgo(t.day, t.hr);
      
      const isAssigned = ["claimed", "completed", "delivered", "in_transit", "picked_up", "accepted"].includes(t.status);
      const randomVol = volunteers[Math.floor(Math.random() * volunteers.length)];
      
      const d = await Donation.create({
        donorId: donors[t.donor]._id,
        donorName: t.name,
        items: [{ itemName: t.item, category: t.cat, quantity: t.qty, unit: t.unit, servings: t.srv }],
        address: t.addr, city: t.city, state: t.st, zip: t.zip,
        lat: t.lat, lng: t.lng,
        pickupDatetime: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000),
        status: t.status,
        priority: t.priority,
        claimedBy: ["claimed", "completed", "delivered", "in_transit", "picked_up"].includes(t.status) ? ngos[Math.floor(Math.random() * ngos.length)]._id : null,
        assignedVolunteer: isAssigned ? randomVol._id : null,
        impact: { estimatedServings: t.srv, weightKg: parseInt(t.qty) || 10, co2Saved: Math.round(t.srv * 0.5) },
      });
      // Override createdAt timestamp
      await Donation.updateOne({ _id: d._id }, { $set: { createdAt } });
      createdDonations.push(d);
    }

    // ── LOGISTICS ──
    console.log("🚚 Creating logistics entries...");
    const completedDonations = createdDonations.filter((d, i) =>
      ["completed", "delivered", "claimed"].includes(donationTemplates[i].status)
    );

    let logCount = 0;
    for (let i = 0; i < completedDonations.length && i < 25; i++) {
      const d = completedDonations[i];
      const tpl = donationTemplates[createdDonations.indexOf(d)];
      const vol = d.assignedVolunteer || volunteers[i % volunteers.length];
      const ngo = d.claimedBy || ngos[i % ngos.length];
      
      let logStatus = "assigned";
      if (tpl.status === "completed" || tpl.status === "delivered") logStatus = "delivered";
      if (tpl.status === "in_transit" || tpl.status === "picked_up") logStatus = "in_progress";
      if (tpl.status === "claimed" || tpl.status === "accepted") logStatus = "assigned";

      await Logistics.create({
        donation: d._id,
        donor: donors[tpl.donor]._id,
        volunteer: vol._id,
        ngo: ngo._id,
        status: logStatus,
        pickupLocation: tpl.addr,
        dropoffLocation: { address: `${ngo.name} Center`, city: tpl.city, state: tpl.st },
        createdAt: daysAgo(tpl.day, tpl.hr + 1),
      });
      logCount++;
    }

    // ── REQUESTS ──
    console.log("📋 Creating NGO food requests...");
    const requestData = [
      { ngo: 0, food: "Cooked meals for 200 people", qty: "200 servings", loc: "Hope Shelter, Bangalore", urgency: "high", status: "fulfilled" },
      { ngo: 1, food: "Rice and dal for weekly program", qty: "50 kg", loc: "Akshaya Patra Kitchen, Mysore", urgency: "medium", status: "fulfilled" },
      { ngo: 2, food: "Breakfast items for children", qty: "100 servings", loc: "Feeding India Hub, Chennai", urgency: "high", status: "approved" },
      { ngo: 0, food: "Fresh fruits for nutrition drive", qty: "30 kg", loc: "Hope Foundation Camp, Bangalore", urgency: "low", status: "fulfilled" },
      { ngo: 1, food: "Evening snacks for elderly care", qty: "75 servings", loc: "Akshaya Patra Shelter, Mysore", urgency: "medium", status: "pending" },
      { ngo: 2, food: "Lunch packets for street children", qty: "150 packets", loc: "Feeding India Center, Chennai", urgency: "critical", status: "pending" },
      { ngo: 0, food: "Wheat flour and oil", qty: "100 kg", loc: "Hope Foundation Rural Camp", urgency: "medium", status: "pending" },
      { ngo: 1, food: "Milk powder for toddlers", qty: "20 kg", loc: "Akshaya Patra Orphanage", urgency: "high", status: "pending" },
      { ngo: 2, food: "Biscuits and juice boxes", qty: "500 packets", loc: "Feeding India Flood Relief", urgency: "critical", status: "pending" },
    ];

    for (const r of requestData) {
      await Request.create({
        ngoId: ngos[r.ngo]._id,
        ngoName: ngos[r.ngo].name,
        foodNeeded: r.food,
        quantity: r.qty,
        location: r.loc,
        urgency: r.urgency,
        status: r.status,
      });
    }

    // ── SUMMARY ──
    console.log("\n" + "═".repeat(55));
    console.log("  ✅  SEED COMPLETE — Dashboard-ready data loaded!");
    console.log("═".repeat(55));
    console.log(`  👥  Users:      ${1 + donors.length + ngos.length + volunteers.length}`);
    console.log(`  🍱  Donations:  ${createdDonations.length} (spread across 7 days)`);
    console.log(`  🚚  Logistics:  ${logCount}`);
    console.log(`  📋  Requests:   ${requestData.length}`);
    console.log("─".repeat(55));
    console.log("  Weekly graph pattern: Mon=3 Tue=5 Wed=4 Thu=7 Fri=6 Sat=8 Sun=5");
    console.log("─".repeat(55));
    console.log("  🔑  Login credentials (all use password: password123):");
    console.log("      Admin:     admin@foodbridge.com");
    console.log("      Donor:     donor1@foodbridge.com");
    console.log("      NGO:       ngo1@foodbridge.com");
    console.log("      Volunteer: volunteer1@foodbridge.com");
    console.log("═".repeat(55) + "\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding database:", err);
    process.exit(1);
  }
}

seedDatabase();
