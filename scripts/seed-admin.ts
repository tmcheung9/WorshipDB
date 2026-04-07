// Script to create an initial admin user
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seedAdmin() {
  const adminUsername = "admin";
  const adminPassword = "admin123"; // CHANGE THIS IN PRODUCTION!
  
  try {
    // Check if admin already exists
    const existing = await db.select().from(users).where(eq(users.username, adminUsername));
    
    if (existing.length > 0) {
      console.log("Admin user already exists");
      return;
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    // Create admin user
    await db.insert(users).values({
      username: adminUsername,
      password: hashedPassword,
      email: "admin@example.com",
      firstName: "系統",
      lastName: "管理員",
      role: "admin",
    });
    
    console.log("✅ Admin user created successfully!");
    console.log("Username: admin");
    console.log("Password: admin123");
    console.log("⚠️  IMPORTANT: Change the default password immediately!");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
    process.exit(1);
  }
}

seedAdmin();
