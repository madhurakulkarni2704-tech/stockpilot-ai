const jwt = require("jsonwebtoken");
const config = require("../config");
const User = require("../models/User");
const { HttpError, asyncHandler } = require("../utils/http");

const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new HttpError(401, "Authentication required");

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, "Session expired. Please sign in again");
  }
  const user = await User.findById(payload.id);
  if (!user) throw new HttpError(401, "This account no longer exists");
  req.user = user;
  next();
});

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role)
    ? next()
    : next(new HttpError(403, "Only an admin can do this"));

module.exports = { protect, requireRole };
