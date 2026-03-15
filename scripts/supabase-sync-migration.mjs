import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const supabaseDir = path.join(rootDir, "supabase");
const schemaDir = path.join(supabaseDir, "schemas");
const configPath = path.join(supabaseDir, "config.toml");

function run(command) {
  console.log(`\n$ ${command}`);
  execSync(command, {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
  });
}

function getMigrationName() {
  const name = process.argv[2]?.trim();
  if (!name) {
    console.error("Usage: pnpm supabase:migration:sync <migration_name>");
    process.exit(1);
  }
  return name;
}

function getDbPort() {
  const config = readFileSync(configPath, "utf8");
  const dbBlock = config.match(/\[db\][\s\S]*?(?=\n\[|$)/);
  const portMatch = dbBlock?.[0].match(/^\s*port\s*=\s*(\d+)/m);
  return Number(portMatch?.[1] ?? 54322);
}

function getSchemaFiles() {
  return readdirSync(schemaDir)
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => ({
      name: file,
      sql: readFileSync(path.join(schemaDir, file), "utf8"),
    }));
}

async function applySchemas() {
  const client = new Client({
    host: process.env.SUPABASE_DB_HOST ?? "127.0.0.1",
    port: Number(process.env.SUPABASE_DB_PORT ?? getDbPort()),
    user: process.env.SUPABASE_DB_USER ?? "postgres",
    password: process.env.SUPABASE_DB_PASSWORD ?? "postgres",
    database: process.env.SUPABASE_DB_NAME ?? "postgres",
  });

  await client.connect();

  try {
    for (const file of getSchemaFiles()) {
      console.log(`Applying schema ${file.name}`);
      await client.query(file.sql);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  const migrationName = getMigrationName();

  run("supabase status >/dev/null 2>&1 || supabase start");
  run("supabase db reset");
  await applySchemas();
  run(`supabase db diff -f ${JSON.stringify(migrationName)}`);
  run("supabase gen types typescript --local > ./lib/database.types.ts");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
