const User = require("../../models/userModel");
const Plan = require("../../models/planModel");
const { getCustomerPrimarySubscription, getPlanFromPriceId } = require("../../utils/stripeUtils");
const sendEmail = require("../../utils/sendEmailResetPassword");
const moment = require("moment");
const pLimit = require("p-limit"); // ✅ Install: npm i p-limit

// Limit concurrency to avoid Stripe rate limits (5 parallel calls)
const stripeLimiter = pLimit(5);
const emailLimiter = pLimit(10);

/**
 * Get user's plan + expiry date
 */
async function getUserCurrentPlan(user, useTestMode = false) {
    try {
        if (!user.stripeCustomerId) {
            const starterPlan = await Plan.findOne({ name: "Starter", isActive: true });
            return { plan: starterPlan, expiresAt: user.trialEnd || null };
        }

        const subscription = await getCustomerPrimarySubscription(user.stripeCustomerId, useTestMode);
        if (!subscription) {
            const starterPlan = await Plan.findOne({ name: "Starter", isActive: true });
            return { plan: starterPlan, expiresAt: user.trialEnd || null };
        }

        const priceId = subscription.items?.data?.[0]?.price?.id;
        const plan = await getPlanFromPriceId(priceId, useTestMode);

        const endDate =
            subscription.trial_end
                ? new Date(subscription.trial_end * 1000)
                : subscription.current_period_end
                    ? new Date(subscription.current_period_end * 1000)
                    : null;

        return {
            plan: plan || (await Plan.findOne({ name: "Starter", isActive: true })),
            expiresAt: endDate,
        };
    } catch (err) {
        console.error("getUserCurrentPlan failed for", user.email, err.message);
        const fallbackPlan = await Plan.findOne({ name: "Starter", isActive: true });
        return { plan: fallbackPlan, expiresAt: user.trialEnd || null };
    }
}

/**
 * Faster API with concurrency control
 */
exports.sendSubscriptionExpiryAlerts = async (req, res) => {
  const useTestMode = req.stripe_test_mode || false;
    try {
        const { days } = req.body;
        if (!days || isNaN(days)) return res.status(400).json({ message: "Invalid 'days' value" });

        const targetStart = moment().add(days, "days").startOf("day");
        const targetEnd = moment(targetStart).endOf("day");

        console.log(`🔍 Searching for users expiring on ${targetStart.format("YYYY-MM-DD")}`);

        // ✅ Only fetch relevant users
        const allUsers = await User.find({
            $or: [
                { stripeCustomerId: { $exists: true, $ne: null } },
                { trialEnd: { $exists: true, $ne: null } },
            ],
        }).select("email firstname lastname stripeCustomerId trialEnd");

        console.log(`👥 Processing ${allUsers.length} users with potential plans`);

        const matchedUsers = [];

        // 🚀 Run Stripe checks in parallel (limited concurrency)
        await Promise.all(
            allUsers.map((user) =>
                stripeLimiter(async () => {
                    const { plan, expiresAt } = await getUserCurrentPlan(user,useTestMode);
                    if (!expiresAt) return;

                    const expiryMoment = moment(expiresAt);
                    if (expiryMoment.isBetween(targetStart, targetEnd, "day", "[]")) {
                        matchedUsers.push({ user, plan, expiresAt });
                    }
                })
            )
        );

        console.log(`✅ Found ${matchedUsers.length} users whose plan expires in ${days} days.`);

        if (matchedUsers.length === 0)
            return res.status(200).json({ message: `No users expiring in ${days} day(s).` });

        // 🚀 Send emails in parallel (limited concurrency)
        let successCount = 0;
        let failedCount = 0;

        await Promise.all(
            matchedUsers.map(({ user, plan, expiresAt }) =>
                emailLimiter(async () => {
                    try {
                        const planName = plan?.name || "Starter";
                        const expiryDateFormatted = moment(expiresAt).format("MMMM Do, YYYY");

                        const emailHtml = `
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Your Subscription is About to Expire</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #ffffff;
      color: #2d313a;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .button {
      display: inline-block;
      background-color: #007bff;
      color: #ffffff !important;
      text-decoration: none;
      padding: 15px 25px;
      border-radius: 5px;
      font-weight: bold;
      margin-top: 20px;
    }
    .footer {
      text-align: center;
      font-size: 14px;
      color: #6c757d;
      margin-top: 30px;
    }
    .footer a {
      color: #007bff;
      text-decoration: none;
    }
    .social-icons img {
      width: 30px;
      margin: 0 5px;
      vertical-align: middle;
    }
    .app-buttons img {
      width: 120px;
      margin: 10px 5px;
    }
  </style>
</head>

<body>
  <div class="container">
    <center>
      <img src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/logoWithName.png"
           alt="Contacts Management Logo" style="width:200px; display:block; margin-bottom:20px;">
    </center>

    <p><strong>Dear ${user.firstname || ""} ${user.lastname || ""},</strong></p>

    <p>This is a friendly reminder that your <strong>${planName}</strong> subscription will expire on 
       <strong>${expiryDateFormatted}</strong>.</p>

    <p>To continue enjoying all premium features without interruption, please renew or upgrade your plan before it expires.</p>

    <center>
      <a href="https://contacts.management/pricing" class="button">Renew My Subscription</a>
    </center>

    <p>If you need help or have any questions, our support team is always ready to assist you.</p>

    <p>Warm regards,<br><strong>Contacts Management Team</strong></p>

    <hr style="margin:30px 0; border:0; border-top:1px solid #ddd;">

    <div class="footer">
      <p>Follow Contacts Management on:</p>
      <div class="social-icons">
        <a href="#"><img src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/facebookIcon.png" alt="Facebook"></a>
        <a href="#"><img src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/instagramIcon.png" alt="Instagram"></a>
        <a href="#"><img src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/linkedinIcon.png" alt="LinkedIn"></a>
        <a href="#"><img src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/twitterIcon.png" alt="Twitter"></a>
        <a href="#"><img src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/youtubeIcon.png" alt="YouTube"></a>
      </div>

      <div class="app-buttons">
        <p>Get the Contacts Management App:</p>
        <a href="#"><img src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/appStoreIcon.png" alt="App Store"></a>
        <a href="#"><img src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/playStoreIcon.png" alt="Google Play"></a>
      </div>

      <p>Need help? <a href="mailto:support@contacts.management">support@contacts.management</a></p>
      <p>Sent with ❤️ from Contacts Management</p>
      <p><a href="https://contacts.management/privacy" target="_blank">Privacy Policy</a></p>
    </div>
  </div>
</body>
</html>
`;


                        await sendEmail(user.email, "Your Subscription is About to Expire", emailHtml);
                        successCount++;
                        console.log("📨 Email sent to", user.email);
                    } catch (e) {
                        failedCount++;
                        console.error("❌ Email failed for", user.email, e.message);
                    }
                })
            )
        );

        res.status(200).json({
            message: "Subscription expiry alerts processed successfully.",
            totalMatchedUsers: matchedUsers.length,
            successCount,
            failedCount,
        });
    } catch (error) {
        console.error("sendSubscriptionExpiryAlerts error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
