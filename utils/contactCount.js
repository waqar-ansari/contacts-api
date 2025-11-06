const mongoose = require("mongoose");
const User = require("../models/userModel"); // ✅ REQUIRED
const { getUserCurrentPlan } = require("./stripeUtils");

async function ensureScanQuotaForOwner(ownerId, category, excludeContactId = null) {
    const owner = await User.findById(ownerId);
    if (!owner) throw new Error("Owner not found for quota check");

    const plan = await getUserCurrentPlan(owner);
    const planName = (plan?.name || "starter").toLowerCase();

    // Starter plan limits:
    const STARTER_TOTAL_LIMIT = 1000;
    const STARTER_QR_LIMIT = 50;
    const STARTER_BUSINESS_LIMIT = 50;
    const STARTER_LEAD_LIMIT = 50; // keep if you want lead limited, else set Infinity

    // Determine per-category limit depending on plan
    const perCategoryLimitsForStarter = {
        qrScan: STARTER_QR_LIMIT,
        businessCardScan: STARTER_BUSINESS_LIMIT,
        lead: STARTER_LEAD_LIMIT,
        manual: Infinity, // manual has no per-category limit for Starter
    };

    // If pro -> unlimited everything
    const isPro = planName === "pro";

    // Count current totals excluding an existing contact (useful for updates)
    const excludeClause = excludeContactId && mongoose.Types.ObjectId.isValid(excludeContactId)
        ? { _id: { $ne: excludeContactId } }
        : {};

    // const totalCount = await Contact.countDocuments({
    //   createdBy: ownerId,
    //   ...excludeClause,
    // });
    const totalCount = await User.findById(ownerId).then(u => u.totalContactCount || 0);
    const leadContactCount = await User.findById(ownerId).then(u => u.leadContactCount || 0);
    const businessCardScanContactCount = await User.findById(ownerId).then(u => u.businessCardScanContactCount || 0);
    const qrScanContactCount = await User.findById(ownerId).then(u => u.qrScanContactCount || 0);
    const manualContactCount = await User.findById(ownerId).then(u => u.manualContactCount || 0);
    // Category specific count (exclude the contact if provided)
    // const categoryCount = await Contact.countDocuments({
    //   createdBy: ownerId,
    //   category,
    //   ...excludeClause,
    // });

    // Enforce total limit for Starter
    if (!isPro && totalCount >= STARTER_TOTAL_LIMIT) {
        throw new Error(
            `Total contact limit reached for Starter plan (${totalCount}/${STARTER_TOTAL_LIMIT}). Upgrade to Pro for unlimited contacts.`
        );
    }

    if (category === "lead") {
        if (!isPro && leadContactCount >= STARTER_LEAD_LIMIT) {
            throw new Error(
                `Plan limit reached for ${category} (${leadContactCount}/${STARTER_LEAD_LIMIT}). Upgrade to Pro for more.`
            );
        }
    } else if (category === "businessCardScan") {
        if (!isPro && businessCardScanContactCount >= STARTER_BUSINESS_LIMIT) {
            throw new Error(
                `Plan limit reached for ${category} (${businessCardScanContactCount}/${STARTER_BUSINESS_LIMIT}). Upgrade to Pro for more.`
            );
        }
    } else if (category === "qrScan") {
        if (!isPro && qrScanContactCount >= STARTER_QR_LIMIT) {
            throw new Error(
                `Plan limit reached for ${category} (${qrScanContactCount}/${STARTER_QR_LIMIT}). Upgrade to Pro for more.`
            );
        }
    } else if (category === "manual") {
        if (!isPro && manualContactCount >= Infinity) {
            throw new Error(
                `Plan limit reached for ${category} (${manualContactCount}/∞). Upgrade to Pro for more.`
            );
        }
    }


    // Enforce per-category limit (only if the category has a finite limit on Starter)
    // if (!isPro) {
    //   const catLimit = perCategoryLimitsForStarter[category] ?? Infinity;
    //   if (catLimit !== Infinity && categoryCount >= catLimit) {
    //     throw new Error(
    //       `Plan limit reached for ${category} (${categoryCount}/${catLimit}). Upgrade to Pro for more.`
    //     );
    //   }
    // }

    // Return remaining (useful if you want to show it)
    return {
        remainingTotal: isPro ? Infinity : STARTER_TOTAL_LIMIT - totalCount,
        remainingTotalLead: isPro ? Infinity : STARTER_LEAD_LIMIT - leadContactCount,
        remainingTotalBusinessCard: isPro ? Infinity : STARTER_BUSINESS_LIMIT - businessCardScanContactCount,
        remainingTotalManual: isPro ? Infinity : Infinity - manualContactCount,
        remainingTotalQrScan: isPro ? Infinity : STARTER_QR_LIMIT - qrScanContactCount,
        // remainingCategory: isPro ? Infinity : (perCategoryLimitsForStarter[category] === Infinity ? Infinity : perCategoryLimitsForStarter[category] - categoryCount),
    };
}


// async function ensureScanQuotaForOwner(ownerId, category, excludeContactId = null) {
//     const owner = await User.findById(ownerId);
//     if (!owner) throw new Error("Owner not found for quota check");

//     const plan = await getUserCurrentPlan(owner);
//     const planName = (plan?.name || "starter").toLowerCase();

//     const STARTER_TOTAL_LIMIT = 1000;
//     const STARTER_QR_LIMIT = 20;
//     const STARTER_BUSINESS_LIMIT = 50;
//     const STARTER_LEAD_LIMIT = 50;

//     const isPro = planName === "pro";

//     const totalCount = owner.totalContactCount || 0;
//     const leadContactCount = owner.leadContactCount || 0;
//     const businessCardScanContactCount = owner.businessCardScanContactCount || 0;
//     const qrScanContactCount = owner.qrScanContactCount || 0;
//     const manualContactCount = owner.manualContactCount || 0;

//     if (!isPro && totalCount >= STARTER_TOTAL_LIMIT) {
//         throw new Error(`Total contact limit reached for Starter plan (${totalCount}/${STARTER_TOTAL_LIMIT}).`);
//     }

//     if (!isPro) {
//         if (category === "lead" && leadContactCount >= STARTER_LEAD_LIMIT)
//             throw new Error(`Lead limit reached (${leadContactCount}/${STARTER_LEAD_LIMIT}).`);
//         if (category === "businessCardScan" && businessCardScanContactCount >= STARTER_BUSINESS_LIMIT)
//             throw new Error(`Business card limit reached (${businessCardScanContactCount}/${STARTER_BUSINESS_LIMIT}).`);
//         if (category === "qrScan" && qrScanContactCount >= STARTER_QR_LIMIT)
//             throw new Error(`QR scan limit reached (${qrScanContactCount}/${STARTER_QR_LIMIT}).`);
//     }

//     return {
//         remaining: {
//             total: isPro ? Infinity : STARTER_TOTAL_LIMIT - totalCount,
//             lead: isPro ? Infinity : STARTER_LEAD_LIMIT - leadContactCount,
//             businessCardScan: isPro ? Infinity : STARTER_BUSINESS_LIMIT - businessCardScanContactCount,
//             qrScan: isPro ? Infinity : STARTER_QR_LIMIT - qrScanContactCount,
//             manual: isPro ? Infinity : Infinity - manualContactCount,
//         },
//     };
// }


async function incrementOwnerCategoryCounter(ownerId, category) {
    const map = {
        qrScan: "qrScanContactCount",
        businessCardScan: "businessCardScanContactCount",
        lead: "leadContactCount",
        manual: "manualContactCount",
    };

    const field = map[category];
    if (!field) return;

    // Increment both the specific category counter and the totalContactCount
    await User.updateOne(
        { _id: ownerId },
        { $inc: { [field]: 1, totalContactCount: 1 } }
    ).catch((err) =>
        console.error("⚠️ Failed to increment owner category/total counter:", err)
    );
}

module.exports = {
    ensureScanQuotaForOwner,
    incrementOwnerCategoryCounter,
};