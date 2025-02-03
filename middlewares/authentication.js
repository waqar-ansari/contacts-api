const { validateToken } = require("../services/authentication");

const checkForAuthentication = () => {
  return (req, res, next) => {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1]; // Extract Bearer token
    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Invalid token format" });
    }

    try {
      const payload = validateToken(token);
      req.user = payload; // Attach user info from token to req.user
      console.log(req.user, "requserr");
    } catch (error) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    next(); // Call next middleware or route handler
  };
};

module.exports = { checkForAuthentication };