// const { validateToken } = require("../services/authentication");

// const checkForAuthentication = () => {
//   return (req, res, next) => {
//     const authHeader = req.headers["authorization"];

//     if (!authHeader) {
//       return res
//         .status(401)
//         .json({ message: "Unauthorized: No token provided" });
//     }

//     const token = authHeader.split(" ")[1];
//     if (!token) {
//       return res
//         .status(401)
//         .json({ message: "Unauthorized: Invalid token format" });
//     }

//     try {
//       const payload = validateToken(token);
//       req.user = payload;
//     } catch (error) {
//       return res.status(401).json({ message: "Invalid or expired token" });
//     }

//     next();
//   };
// };

// module.exports = { checkForAuthentication };

const { validateToken } = require("../services/authentication");
const BlacklistedToken = require("../models/blacklistedTokenModel");

const checkForAuthentication = () => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers["authorization"];

      if (!authHeader) {
        return res.status(401).json({ message: "Unauthorized: No token provided" });
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).json({ message: "Unauthorized: Invalid token format" });
      }

      // ✅ Check if token is blacklisted
      const blacklisted = await BlacklistedToken.findOne({ token });
      if (blacklisted) {
        return res.status(401).json({ message: "Token has been invalidated. Please log in again." });
      }

      // ✅ Validate JWT
      const payload = validateToken(token);

      req.user = payload;
      req.token = token; // store current token for logout
      next();
    } catch (error) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  };
};

module.exports = { checkForAuthentication };
