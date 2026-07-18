const mongoose = require("mongoose");
require("dotenv").config();

async function checkUsers() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI not found in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB");

    const users = await mongoose.connection.db.collection("users").find({}).toArray();
    console.log("Users in database:");
    users.forEach(u => {
      console.log(`- Email: ${u.email}, Role: ${u.role}, Name: ${u.name}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

checkUsers();
