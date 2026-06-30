import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

async function seed() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const users = [
    { name: "Demo Trader", email: "demo@tradestream.io" },
    { name: "Counterparty Bot", email: "bot@tradestream.io" },
  ];

  for (const u of users) {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [u.email]);
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (name, email, password_hash, balance) VALUES ($1, $2, $3, 100000)`,
        [u.name, u.email, passwordHash]
      );
      console.log(`Created user ${u.email} (password: password123)`);
    } else {
      console.log(`User ${u.email} already exists, skipping`);
    }
  }

  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
