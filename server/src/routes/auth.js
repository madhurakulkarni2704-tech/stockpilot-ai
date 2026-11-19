const express = require("express");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const config = require("../config");
const User = require("../models/User");
const validate = require("../middleware/validate");
const { protect } = require("../middleware/auth");
const { HttpError, asyncHandler } = require("../utils/http");

const router = express.Router();

const sign = (user) => jwt.sign({ id: user._id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

// The first account becomes the admin; everyone after is staff.
router.post(
  "/register",
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    if (await User.exists({ email: req.body.email })) throw new HttpError(409, "An account with this email already exists");
    const role = (await User.countDocuments()) === 0 ? "admin" : "staff";
    const user = await User.create({ ...req.body, role });
    res.status(201).json({ token: sign(user), user });
  })
);

router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email }).select("+password");
    if (!user || !(await user.comparePassword(req.body.password))) {
      throw new HttpError(401, "Incorrect email or password");
    }
    res.json({ token: sign(user), user });
  })
);

router.get("/me", protect, (req, res) => res.json({ user: req.user }));

module.exports = router;
