const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  await db.collection('users').updateOne(
    { email: 'admin@foodbridge.org' },
    { $set: { 'address.location': 'Bangalore Main Office, Karnataka' } }
  );
  console.log('Admin location updated');
  await mongoose.disconnect();
}

main().catch(console.error);
