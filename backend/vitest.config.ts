import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgresql://u:p@localhost:5432/db",
      JWT_SECRET: "test-secret-min-16chars-vitest",
    },
  },
});
