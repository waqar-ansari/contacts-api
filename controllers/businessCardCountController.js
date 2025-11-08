const mongoose = require("mongoose");
const User = require("../models/userModel");
const Contact = require("../models/contactModel");
const { ensureScanQuotaForOwner, incrementOwnerCategoryCounter } = require("../utils/contactCount");

// async function ensureScanQuotaForOwner(ownerId, category, excludeContactId = null) {
//     const owner = await User.findById(ownerId);
//     if (!owner) throw new Error("Owner not found for quota check");

//     const plan = await getUserCurrentPlan(owner);
//     const planName = (plan?.name || "starter").toLowerCase();

//     // Starter plan limits:
//     const STARTER_TOTAL_LIMIT = 1000;
//     const STARTER_QR_LIMIT = 50;
//     const STARTER_BUSINESS_LIMIT = 50;
//     const STARTER_LEAD_LIMIT = 50; // keep if you want lead limited, else set Infinity

//     // Determine per-category limit depending on plan
//     const perCategoryLimitsForStarter = {
//         qrScan: STARTER_QR_LIMIT,
//         businessCardScan: STARTER_BUSINESS_LIMIT,
//         lead: STARTER_LEAD_LIMIT,
//         manual: Infinity, // manual has no per-category limit for Starter
//     };

//     // If pro -> unlimited everything
//     const isPro = planName === "pro";

//     // Count current totals excluding an existing contact (useful for updates)
//     const excludeClause = excludeContactId && mongoose.Types.ObjectId.isValid(excludeContactId)
//         ? { _id: { $ne: excludeContactId } }
//         : {};

//     // const totalCount = await Contact.countDocuments({
//     //   createdBy: ownerId,
//     //   ...excludeClause,
//     // });
//     const totalCount = await User.findById(ownerId).then(u => u.totalContactCount || 0);
//     const leadContactCount = await User.findById(ownerId).then(u => u.leadContactCount || 0);
//     const businessCardScanContactCount = await User.findById(ownerId).then(u => u.businessCardScanContactCount || 0);
//     const qrScanContactCount = await User.findById(ownerId).then(u => u.qrScanContactCount || 0);
//     const manualContactCount = await User.findById(ownerId).then(u => u.manualContactCount || 0);
//     // Category specific count (exclude the contact if provided)
//     // const categoryCount = await Contact.countDocuments({
//     //   createdBy: ownerId,
//     //   category,
//     //   ...excludeClause,
//     // });

//     // Enforce total limit for Starter
//     if (!isPro && totalCount >= STARTER_TOTAL_LIMIT) {
//         throw new Error(
//             `Total contact limit reached for Starter plan (${totalCount}/${STARTER_TOTAL_LIMIT}). Upgrade to Pro for unlimited contacts.`
//         );
//     }

//     if (category === "lead") {
//         if (!isPro && leadContactCount >= STARTER_LEAD_LIMIT) {
//             throw new Error(
//                 `Plan limit reached for ${category} (${leadContactCount}/${STARTER_LEAD_LIMIT}). Upgrade to Pro for more.`
//             );
//         }
//     } else if (category === "businessCardScan") {
//         if (!isPro && businessCardScanContactCount >= STARTER_BUSINESS_LIMIT) {
//             throw new Error(
//                 `Plan limit reached for ${category} (${businessCardScanContactCount}/${STARTER_BUSINESS_LIMIT}). Upgrade to Pro for more.`
//             );
//         }
//     } else if (category === "qrScan") {
//         if (!isPro && qrScanContactCount >= STARTER_QR_LIMIT) {
//             throw new Error(
//                 `Plan limit reached for ${category} (${qrScanContactCount}/${STARTER_QR_LIMIT}). Upgrade to Pro for more.`
//             );
//         }
//     } else if (category === "manual") {
//         if (!isPro && manualContactCount >= Infinity) {
//             throw new Error(
//                 `Plan limit reached for ${category} (${manualContactCount}/∞). Upgrade to Pro for more.`
//             );
//         }
//     }


//     // Enforce per-category limit (only if the category has a finite limit on Starter)
//     // if (!isPro) {
//     //   const catLimit = perCategoryLimitsForStarter[category] ?? Infinity;
//     //   if (catLimit !== Infinity && categoryCount >= catLimit) {
//     //     throw new Error(
//     //       `Plan limit reached for ${category} (${categoryCount}/${catLimit}). Upgrade to Pro for more.`
//     //     );
//     //   }
//     // }

//     // Return remaining (useful if you want to show it)
//     return {
//         remainingTotal: isPro ? Infinity : STARTER_TOTAL_LIMIT - totalCount,
//         remainingTotal: isPro ? Infinity : STARTER_LEAD_LIMIT - leadContactCount,
//         remainingTotal: isPro ? Infinity : STARTER_BUSINESS_LIMIT - businessCardScanContactCount,
//         remainingTotal: isPro ? Infinity : Infinity - manualContactCount,
//         remainingCategory: isPro ? Infinity : STARTER_QR_LIMIT - qrScanContactCount,
//         // remainingCategory: isPro ? Infinity : (perCategoryLimitsForStarter[category] === Infinity ? Infinity : perCategoryLimitsForStarter[category] - categoryCount),
//     };
// }

// // === COUNTER INCREMENT FUNCTION ===
// async function incrementOwnerCategoryCounter(ownerId, category) {
//     const map = {
//         qrScan: "qrScanContactCount",
//         businessCardScan: "businessCardScanContactCount",
//         lead: "leadContactCount",
//         manual: "manualContactCount",
//     };

//     const field = map[category];
//     if (!field) return;

//     await User.updateOne(
//         { _id: ownerId },
//         { $inc: { [field]: 1, totalContactCount: 1 } }
//     ).catch((err) =>
//         console.error("⚠️ Failed to increment owner category/total counter:", err)
//     );
// }

// === MAIN API CONTROLLER ===
exports.incrementBusinessCardScan = async (req, res) => {
    try {
        const ownerId = req.user._id;

        if (!ownerId) {
            return res.status(400).json({ success: false, message: "ownerId is required" });
        }

        // Step 1: Check scan quota
        try {
            await ensureScanQuotaForOwner(ownerId, "businessCardScan");
        } catch (quotaError) {
            return res.status(403).json({
                status: "error",
                message: quotaError.message || "Quota exceeded for business card scans",
            });
        }

        // Step 2: Increment business card scan + total
        await incrementOwnerCategoryCounter(ownerId, "businessCardScan");

        // Step 3: Return updated user info
        const updatedUser = await User.findById(ownerId).select(
            "businessCardScanContactCount totalContactCount"
        );

        return res.status(200).json({
            status: "success",
            message: "Business card scan count incremented successfully",
            data: updatedUser,
        });
    } catch (error) {
        console.error("🚨 Error incrementing business card scan count:", error);
        return res.status(400).json({
            status: "error",
            message: error.message || "Something went wrong",
        });
    }
};
