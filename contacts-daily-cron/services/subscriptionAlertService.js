const User = require("../models/userModel");
const { getUserCurrentPlan } = require("../utils/stripeUtils");
const sendEmail = require("../utils/sendEmail");
const moment = require("moment");
const pLimit = require("p-limit");

// Limit concurrency to avoid Stripe rate limits and email service limits
const stripeLimiter = pLimit(5);
const emailLimiter = pLimit(10);

/**
 * Generate the email HTML template for subscription expiry alert
 * @param {Object} user - User object
 * @param {string} planName - Name of the plan
 * @param {string} expiryDateFormatted - Formatted expiry date
 * @returns {string} HTML email template
 */
function generateExpiryEmailTemplate(user, planName, expiryDateFormatted) {
  return `
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
}

/**
 * Send subscription expiry alerts to users whose plans expire in N days
 * @param {number} daysBeforeExpiry - Number of days before expiry to send alert
 * @returns {Object} Result object with statistics
 */
async function sendSubscriptionExpiryAlerts(daysBeforeExpiry = 7) {
  try {
    console.log(
      `🔍 Starting subscription expiry alert job for ${daysBeforeExpiry} days before expiry...`
    );

    console.log(
      `📅 Looking for users whose subscriptions expire in exactly ${daysBeforeExpiry} days`
    );

    // Fetch only relevant users (those with Stripe customers or trial ends)
    const allUsers = await User.find({
      role: "user",
      $or: [
        { stripeCustomerId: { $exists: true, $ne: null } },
        { trialEnd: { $exists: true, $ne: null } },
      ],
    }).select("email firstname lastname stripeCustomerId trialEnd");

    console.log(`👥 Processing ${allUsers.length} users with potential plans`);

    const matchedUsers = [];

    // Run Stripe checks in parallel with concurrency control
    await Promise.all(
      allUsers.map((user) =>
        stripeLimiter(async () => {
          const {
            plan,
            expiresAt,
            subscriptionStatus,
            cancelAtPeriodEnd,
            isTrialing,
          } = await getUserCurrentPlan(user);

          if (!expiresAt) {
            console.log(
              `⚠️ User ${user.email} - No expiry date found, they are on starter plan.`
            );
            return;
          }

          const expiryMoment = moment(expiresAt);
          const now = moment();
          const daysUntilExpiry = expiryMoment.diff(now, "days");

          const expiryDate = moment(expiresAt).format("YYYY-MM-DD");

          const statusInfo = cancelAtPeriodEnd ? " [CANCELING]" : "";
          const trialInfo = isTrialing ? " [TRIAL]" : "";

          // Log every user's expiry details
          console.log(
            `User ${user.email} | Plan: ${
              plan?.name || "Starter"
            } | Status: ${subscriptionStatus}${statusInfo}${trialInfo} | Expires: ${expiryDate} | Days from now: ${daysUntilExpiry}`
          );

          // Match if days until expiry equals the target days
          if (daysUntilExpiry === daysBeforeExpiry) {
            matchedUsers.push({ user, plan, expiresAt });
            console.log(
              `✅ MATCHED for ${daysBeforeExpiry}-day alert: ${user.email}`
            );
          }
        })
      )
    );

    console.log(
      `✅ Found ${matchedUsers.length} users whose plan expires in ${daysBeforeExpiry} days.`
    );

    if (matchedUsers.length === 0) {
      console.log(`ℹ️ No users expiring in ${daysBeforeExpiry} day(s).`);
      return {
        success: true,
        message: `No users expiring in ${daysBeforeExpiry} day(s).`,
        totalMatchedUsers: 0,
        successCount: 0,
        failedCount: 0,
      };
    }

    // Send emails in parallel with concurrency control
    let successCount = 0;
    let failedCount = 0;

    await Promise.all(
      matchedUsers.map(({ user, plan, expiresAt }) =>
        emailLimiter(async () => {
          try {
            const planName = plan?.name || "Starter";
            const expiryDateFormatted =
              moment(expiresAt).format("MMMM Do, YYYY");

            const emailHtml = generateExpiryEmailTemplate(
              user,
              planName,
              expiryDateFormatted
            );

            await sendEmail(
              user.email,
              "Your Subscription is About to Expire",
              emailHtml
            );
            successCount++;
            console.log(`📨 Email sent to ${user.email}`);
          } catch (e) {
            failedCount++;
            console.error(`❌ Email failed for ${user.email}:`, e.message);
          }
        })
      )
    );

    console.log(
      `✅ Subscription expiry alerts completed. Success: ${successCount}, Failed: ${failedCount}`
    );

    return {
      success: true,
      message: "Subscription expiry alerts processed successfully.",
      totalMatchedUsers: matchedUsers.length,
      successCount,
      failedCount,
    };
  } catch (error) {
    console.error("❌ sendSubscriptionExpiryAlerts error:", error);
    return {
      success: false,
      message: "Server error",
      error: error.message,
    };
  }
}

module.exports = {
  sendSubscriptionExpiryAlerts,
};
