// Migration script to add Stripe promotion codes to existing coupons
// Run this once after deploying the new coupon functionality

const mongoose = require("mongoose");
const Coupon = require("../models/couponModel");
const { createStripePromotionCode } = require("../utils/stripeUtils");

async function migrateCoupons() {
  try {
    console.log("Starting promotion code migration for existing coupons...");

    // Find all active coupons that have Stripe coupon IDs but no promotion code IDs
    const couponsToMigrate = await Coupon.find({
      isActive: true,
      stripeCouponId: { $exists: true, $ne: null },
      $or: [
        { stripePromotionCodeId: { $exists: false } },
        { stripePromotionCodeId: null },
      ],
    });

    console.log(`Found ${couponsToMigrate.length} coupons to migrate`);

    let successCount = 0;
    let errorCount = 0;

    for (const coupon of couponsToMigrate) {
      try {
        console.log(`Migrating coupon: ${coupon.couponCode}`);

        // Create promotion code for this coupon
        const stripePromotionCode = await createStripePromotionCode(
          coupon.stripeCouponId,
          coupon.couponCode,
          {
            active: coupon.isActive,
            max_redemptions: coupon.maxUsage || undefined,
          }
        );

        // Update the coupon with the promotion code ID
        await Coupon.findByIdAndUpdate(coupon._id, {
          stripePromotionCodeId: stripePromotionCode.id,
        });

        console.log(
          `✅ Successfully created promotion code for ${coupon.couponCode}: ${stripePromotionCode.id}`
        );
        successCount++;
      } catch (error) {
        console.error(
          `❌ Error migrating coupon ${coupon.couponCode}:`,
          error.message
        );
        errorCount++;
      }
    }

    console.log("\n=== Migration Summary ===");
    console.log(`Total coupons processed: ${couponsToMigrate.length}`);
    console.log(`Successful migrations: ${successCount}`);
    console.log(`Failed migrations: ${errorCount}`);
    console.log("Migration completed!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

// If running this script directly
if (require.main === module) {
  const { connectDB } = require("../config/database");

  connectDB()
    .then(() => {
      console.log("Database connected for migration");
      return migrateCoupons();
    })
    .then(() => {
      console.log("Migration script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script failed:", error);
      process.exit(1);
    });
}

module.exports = { migrateCoupons };
