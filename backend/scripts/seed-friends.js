import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../src/config/db.js";
import { User } from "../src/models/User.js";

/**
 * Seed preset friend players (role: player).
 * Run from repo root: cd backend && node scripts/seed-friends.js
 * Requires MONGO_URI in .env (same as the API server).
 */
const FRIENDS = [
  { name: "Deva", email: "deva@gmail.com", password: "deva007" },
  { name: "Dharnish", email: "dharnish@gmail.com", password: "dharnish007" },
  { name: "Thor", email: "thor@gmail.com", password: "thor007" },
  { name: "Ray", email: "ray@gmail.com", password: "ray007" },
  { name: "Deepak", email: "deepak@gmail.com", password: "deepak007" },
  { name: "Aravind", email: "aravind@gmail.com", password: "aravind007" },
  { name: "Aravindhan", email: "aravindhan@gmail.com", password: "aravindhan007" },
  { name: "Dharun", email: "dharun@gmail.com", password: "dharun007" },
  { name: "Prakash", email: "prakash@gmail.com", password: "prakash007" },
  { name: "Aswath", email: "aswath@gmail.com", password: "aswath007" },
  { name: "Hari", email: "hari@gmail.com", password: "hari007" },
  { name: "Dinesh", email: "dinesh@gmail.com", password: "dinesh007" },
  { name: "Arun", email: "arun@gmail.com", password: "arun007" },
  { name: "Arthur", email: "arthur@gmail.com", password: "arthur007" },
  { name: "Giri", email: "giri@gmail.com", password: "giri007" }
];

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("Missing MONGO_URI in environment.");
  process.exit(1);
}

await connectDb(mongoUri);

let created = 0;
let skipped = 0;

for (const row of FRIENDS) {
  const exists = await User.findOne({ email: row.email.toLowerCase() });
  if (exists) {
    console.log(`Skip (exists): ${row.name} <${row.email}>`);
    skipped += 1;
    continue;
  }
  await User.create({
    name: row.name,
    email: row.email,
    password: row.password,
    role: "player",
    isCaptain: false
  });
  console.log(`Created: ${row.name} <${row.email}>`);
  created += 1;
}

console.log(`Done. Created ${created}, skipped ${skipped}.`);
await mongoose.connection.close();
