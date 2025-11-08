const mongoose = require("mongoose");
const User = require("../models/userModel");  // ✅ ADD THIS
// const { ensureScanQuotaForOwner } = require("../utils/contactCount");

exports.getContactCounts = async (req, res) => {
    try {
        const ownerId = req.user._id;
        // console.log(userId);

        const user = await User.findById(ownerId);

        console.log(user);
        

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Get user's current plan (optional if you want to verify)
        // const isPro = plan?.name?.toLowerCase() === "pro";

        // For each category, reuse your ensureScanQuotaForOwner helper
        // const qrInfo = await ensureScanQuotaForOwner(ownerId, "qrScan");
        // const businessInfo = await ensureScanQuotaForOwner(ownerId, "businessCardScan");
        // const leadInfo = await ensureScanQuotaForOwner(ownerId, "lead");
        // const manualInfo = await ensureScanQuotaForOwner(ownerId, "manual");

        // Prepare counts (from DB)
        const counts = {
            qrScan: user.qrScanContactCount || 0,
            businessCardScan: user.businessCardScanContactCount || 0,
            lead: user.leadContactCount || 0,
            manual: user.manualContactCount || 0,
            total: user.totalContactCount || 0,
        };

        // Prepare remaining based on helper function output
        // const remaining = {
        //     qrScan: qrInfo.remainingTotalQrScan,
        //     businessCardScan: businessInfo.remainingTotalBusinessCard,
        //     lead: leadInfo.remainingTotalLead, // or remainingCategory if you track by that
        //     manual: manualInfo.remainingTotalManual,
        //     total: qrInfo.remainingTotal, // all helpers return total count check
        // };

        return res.status(200).json({
            status: "success",
            message: "Contact counts retrieved",
            // plan: isPro ? "pro" : "starter",
            counts,
            // remaining,
        });
    } catch (err) {
        console.error("❌ Error in getContactCounts:", err.message);
        res.status(500).json({ success: false, message: err.message || "Server error" });
    }
};
