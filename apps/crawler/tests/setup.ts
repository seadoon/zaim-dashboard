import path from "node:path";

try {
  process.loadEnvFile(path.resolve(process.cwd(), "../../.env"));
} catch {
  // .env file not found (e.g., CI environment)
}
