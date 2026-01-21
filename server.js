const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const http = require("http");
const dotenv = require("dotenv");
dotenv.config({ path: ".env" });

// Swagger
const basicAuth = require("express-basic-auth");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./utils/swaggerConfig");
const { SwaggerTheme } = require("swagger-themes");
const theme = new SwaggerTheme();

// Routes
const userRouter = require("./Route/user_routes");
const fileRouter = require("./Route/filesystem_routes");
const profileRouter = require("./Route/Profile_routes");

// Utils
const AppError = require("./utils/appError");
const globalErrorHandler = require("./Controller/error_controller");

// Socket
const { initializeSocket } = require("./socket.io/webSocket");

const app = express();
const server = http.createServer(app);
initializeSocket(server);

// ==================================================
// TRUST PROXY (VERCEL HTTPS + COOKIES)
app.enable("trust proxy");

// ==================================================
// CORS
const allowedOrigins = [
  "http://localhost:3000", // local dev
  process.env.FRONTEND_URL, // deployed frontend from env
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like Postman)
      if (!origin) return callback(null, true);

      // allow localhost, env frontend URL, or any vercel frontend subdomain
      if (allowedOrigins.includes(origin) || origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Preflight requests
app.options("*", cors());

// ==================================================
// BODY PARSERS
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

// ==================================================
// SWAGGER
app.use(
  "/api-docs",
  basicAuth({
    users: { [process.env.SWAGGER_USERNAME]: process.env.SWAGGER_PASSWORD },
    challenge: true,
  }),
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: theme.getBuffer("dark"),
  }),
);

// ==================================================
// CREATE FOLDERS
["files", "uploads"].forEach((folder) => {
  const folderPath = path.join(process.cwd(), folder);
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
});

// ==================================================
// STATIC FILES
app.use("/files", express.static(path.join(process.cwd(), "files")));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ==================================================
// ROUTES
app.use("/api/v1/user", userRouter);
app.use("/api/v1/upload", fileRouter);
app.use("/api/v1/profile", profileRouter);

// ==================================================
// 404 HANDLER
app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl}`, 404));
});

// ==================================================
// GLOBAL ERROR HANDLER
app.use(globalErrorHandler);

// ==================================================
// DATABASE
mongoose
  .connect(process.env.mongo_uri)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("DB connection error:", err));

// ==================================================
// SERVER
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
