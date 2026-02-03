const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnvFile(fileName) {
  try {
    const filePath = path.resolve(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, "utf8");
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) return;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();

      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    });
  } catch {
    // Fail open
  }
}

async function run() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.E2E_EMAIL || process.env.SUPABASE_USER_EMAIL;
  const password = process.env.E2E_PASSWORD || process.env.SUPABASE_USER_PASSWORD;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin configuration.");
  }
  if (!email || !password) {
    throw new Error("Missing user email/password. Set E2E_EMAIL/E2E_PASSWORD or SUPABASE_USER_EMAIL/SUPABASE_USER_PASSWORD.");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: listData, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    throw new Error(`List users failed: ${listError.message}`);
  }

  const user = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    throw new Error("User not found. Sign in with Google once using this email, then retry.");
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
  });

  if (updateError) {
    throw new Error(`Update user failed: ${updateError.message}`);
  }

  console.log("Password added to existing user:", user.email);
}

run().catch((error) => {
  console.error("[link-password-to-google-user]", error.message || error);
  process.exit(1);
});
