const User = require("../models/userModel");

// @desc Scan QR and save data
// @route POST /api/scan
exports.scanUser = async (req, res) => {
    const { ScannerID, UserID } = req.body;
  
    try {
      const scanner = await User.findById(ScannerID);
      const scanned = await User.findById(UserID);
  
      if (!scanner || !scanned) {
        return res.status(404).json({ message: "User not found" });
      }
  
      // Ensure fields exist
      if (!scanner.iScanned) scanner.iScanned = [];
      if (!scanned.scannedMe) scanned.scannedMe = [];
  
      // Update relationships if not already added
      if (!scanner.iScanned.includes(UserID)) {
        scanner.iScanned.push(UserID);
        await scanner.save();
      }
  
      if (!scanned.scannedMe.includes(ScannerID)) {
        scanned.scannedMe.push(ScannerID);
        await scanned.save();
      }
  
      res.status(200).json({
        message: "Scan successful",
        Scanner: scanner,
        ScannedUser: scanned,
      });
  
    } catch (error) {
      console.error("Scan error:", error);
      res.status(500).json({ error: error.message });
    }
  };
  

// @desc Get my scan data
// @route GET /api/scan/:userId
exports.getScanData = async (req, res) => {
    const { userId } = req.user._id;

    try {
        const user = await User.findById(userId)
            .populate("iScanned", "firstname lastname email profileImageURL")
            .populate("scannedMe", "firstname lastname email profileImageURL");

        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({
            scannedMe: user.scannedMe,
            iScanned: user.iScanned,
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
