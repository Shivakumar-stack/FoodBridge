require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const Donation = require("../models/Donation");

async function run() {
  const args = process.argv.slice(2);
  const isExecute = args.includes("--execute");
  const isDryRun = args.includes("--dry-run");

  if (!isExecute && !isDryRun) {
    console.error("Usage: node migrate-image-urls.js [--dry-run | --execute]");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");
    console.log(isExecute ? "Running in EXECUTE mode." : "Running in DRY RUN mode.");

    // Target absolute localhost URLs
    const query = {
      $or: [
        { image: { $regex: /^http:\/\/(127\.0\.0\.1|localhost):5000\//i } },
        { "items.image": { $regex: /^http:\/\/(127\.0\.0\.1|localhost):5000\//i } }
      ]
    };

    const donations = await Donation.find(query);
    console.log(`Found ${donations.length} records with legacy localhost URLs.`);

    let updatedCount = 0;

    for (const donation of donations) {
      let modified = false;

      // Check global image
      if (donation.image && /^http:\/\/(127\.0\.0\.1|localhost):5000\//i.test(donation.image)) {
        const relativeUrl = donation.image.replace(/^http:\/\/(127\.0\.0\.1|localhost):5000\//i, "/");
        if (isExecute) {
          donation.image = relativeUrl;
        } else {
          console.log(`[DRY RUN] Would update donation ${donation._id} image: ${donation.image} -> ${relativeUrl}`);
        }
        modified = true;
      }

      // Check items
      if (donation.items && donation.items.length > 0) {
        for (let i = 0; i < donation.items.length; i++) {
          if (donation.items[i].image && /^http:\/\/(127\.0\.0\.1|localhost):5000\//i.test(donation.items[i].image)) {
            const relativeUrl = donation.items[i].image.replace(/^http:\/\/(127\.0\.0\.1|localhost):5000\//i, "/");
            if (isExecute) {
              donation.items[i].image = relativeUrl;
            } else {
              console.log(`[DRY RUN] Would update donation ${donation._id} item ${i} image: ${donation.items[i].image} -> ${relativeUrl}`);
            }
            modified = true;
          }
        }
      }

      if (modified) {
        if (isExecute) {
          await donation.save();
        }
        updatedCount++;
      }
    }

    if (isExecute) {
      console.log(`Migration complete. Successfully updated ${updatedCount} records.`);
    } else {
      console.log(`Dry run complete. Found ${updatedCount} records requiring update.`);
    }

  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

run();
