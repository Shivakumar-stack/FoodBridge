const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/foodbridge";

async function seedTestUser() {
  try {
    console.log(`Connecting to MongoDB at ${MONGO_URI}...`);
    await mongoose.connect(MONGO_URI);
    console.log("Connected successfully.");

    const coll = mongoose.connection.collection("users");
    
    const email = "donor1@foodbridge.com";
    const password = "password123";
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = {
      _id: new mongoose.Types.ObjectId("4d20f496c767bf3946b93c8c"),
      email: email,
      password: hashedPassword,
      role: "donor",
      firstName: "Donor",
      lastName: "One",
      name: "Donor One",
      status: "active",
      loginCount: 0,
      isEmailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0
    };

    await coll.deleteOne({ email });
    await coll.insertOne(user);
    
    console.log(`Successfully seeded test user: ${email}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
}

seedTestUser();
