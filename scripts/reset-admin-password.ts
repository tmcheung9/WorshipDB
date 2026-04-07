// Script to reset admin password
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function resetPassword() {
  const newPassword = "admin123";
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  const result = await db.update(users)
    .set({ password: hashedPassword })
    .where(eq(users.username, "admin"))
    .returning();
  
  if (result.length > 0) {
    console.log("✅ Admin password reset successfully!");
    console.log("Username: admin");
    console.log("Password: admin123");
  } else {
    console.log("❌ Admin user not found");
  }
  
  process.exit(0);
}

resetPassword().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
