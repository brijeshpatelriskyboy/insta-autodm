import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

const host = env.NODE_ENV === "production" ? "0.0.0.0" : "localhost";

app.listen(env.PORT, host, () => {
  console.log(`Insta AutoDM API running on http://${host}:${env.PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
});
