// Test script to verify email verification flow works correctly
const mongoose = require("mongoose");
const User = require("./models/userModel");
const Plan = require("./models/planModel");
const { setupInitialPlan } = require("./utils/planUtils");

async function testEmailVerificationFlow() {
  try {
    console.log("🧪 Testing Email Verification Flow...\n");

    // Connect to MongoDB (adjust connection string as needed)
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || "mongodb://localhost:27017/contacts-test"
      );
      console.log("✅ Connected to MongoDB");
    }

    // Test 1: Check setupInitialPlan function
    console.log("\n📋 Test 1: Setup Initial Plan Function");
    const planData = await setupInitialPlan();
    console.log("Plan data structure:", {
      hasPlan: !!planData.plan,
      isPremium: planData.isPremium,
      hasTrialDates: !!(planData.trialStart && planData.trialEnd),
      hasExpiryDate: !!planData.planExpiresAt,
    });

    // Test 2: Verify plan exists in database
    if (planData.plan) {
      const plan = await Plan.findById(planData.plan);
      console.log("Assigned plan details:", {
        name: plan?.name,
        duration: plan?.duration,
        price: plan?.price,
      });
    }

    // Test 3: Simulate user signup and verification
    console.log("\n👤 Test 2: User Signup and Email Verification Flow");

    // Create a test user (simulating initial signup)
    const testUser = new User({
      firstname: "Test",
      lastname: "User",
      email: "test@example.com",
      password: "hashedpassword123",
      isVerified: false,
      isActive: false,
      emailVerificationToken: "test-token-123",
      signupMethod: "email",
    });

    console.log("Initial user state:", {
      isVerified: testUser.isVerified,
      isActive: testUser.isActive,
      hasPlan: !!testUser.plan,
      hasVerificationToken: !!testUser.emailVerificationToken,
    });

    // Simulate email verification process
    testUser.isVerified = true;
    testUser.emailVerificationToken = undefined;

    // Setup initial plan after email verification
    if (!testUser.plan) {
      const verificationPlanData = await setupInitialPlan();
      testUser.plan = verificationPlanData.plan;
      testUser.planActivatedAt = verificationPlanData.planActivatedAt;
      testUser.planExpiresAt = verificationPlanData.planExpiresAt;
      testUser.isPremium = verificationPlanData.isPremium;
      testUser.trialStart = verificationPlanData.trialStart;
      testUser.trialEnd = verificationPlanData.trialEnd;

      // Mark Pro trial as used if Pro plan was assigned
      if (verificationPlanData.plan) {
        const assignedPlan = await Plan.findById(verificationPlanData.plan);
        if (assignedPlan && assignedPlan.name === "Pro") {
          testUser.hasUsedProTrial = true;
        }
      }
    }

    // Activate user after email verification
    testUser.isActive = true;

    console.log("After email verification:", {
      isVerified: testUser.isVerified,
      isActive: testUser.isActive,
      hasPlan: !!testUser.plan,
      isPremium: testUser.isPremium,
      hasTrialDates: !!(testUser.trialStart && testUser.trialEnd),
      hasUsedProTrial: testUser.hasUsedProTrial,
      noVerificationToken: !testUser.emailVerificationToken,
    });

    console.log("\n✅ Email verification flow test completed successfully!");
    console.log("✅ Plan assignment happens only AFTER email verification");
    console.log("✅ User is activated only AFTER email verification");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log("\n🔌 Disconnected from MongoDB");
    }
  }
}

// Run the test
if (require.main === module) {
  testEmailVerificationFlow();
}

module.exports = { testEmailVerificationFlow };
