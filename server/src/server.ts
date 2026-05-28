import "dotenv/config";
import app from "./app";

// ══════════════════════════════════════════════════════════════
// SERVER ENTRY POINT
// ══════════════════════════════════════════════════════════════
// Starts the HTTP server. Separate from app.ts so the Express
// app can be imported independently for testing (supertest).
//
import { createServer } from "http";
import { initSocket } from "./lib/socket";

const PORT = process.env.PORT || 4000;

const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
