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
 * @param {number} daysLeft - Number of days left until expiry
 * @param {boolean} isTrialing - Whether the subscription is in trial
 * @returns {string} HTML email template
 */
function generateExpiryEmailTemplate(
  user,
  planName,
  expiryDateFormatted,
  daysLeft,
  isTrialing
) {
  const userName =
    `${user.firstname || ""} ${user.lastname || ""}`.trim() || "there";
  const daysText = daysLeft === 1 ? "1 day" : `${daysLeft} days`;

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
      line-height: 1.6;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo img {
      width: 200px;
    }
    .content {
      font-size: 15px;
    }
    .highlight {
      background-color: #f8f9fa;
      border-left: 4px solid #007bff;
      padding: 15px;
      margin: 20px 0;
    }
    .benefits {
      margin: 20px 0;
    }
    .benefits ul {
      list-style: none;
      padding: 0;
    }
    .benefits li {
      padding: 8px 0;
      padding-left: 25px;
      position: relative;
    }
    .benefits li:before {
      content: "✓";
      color: #28a745;
      font-weight: bold;
      position: absolute;
      left: 0;
    }
    .button {
      display: inline-block;
      background-color: #007bff;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 30px;
      border-radius: 5px;
      font-weight: bold;
      margin: 20px 0;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 14px;
      color: #6c757d;
    }
  </style>
</head>

<body>
  <div class="container">
    <div class="logo">
      <img src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/logoWithName.png"
           alt="Contacts Management Logo">
    </div>

    <div class="content">
      <p>Hi ${userName},</p>

      ${
        isTrialing
          ? `<p>Your <strong>${planName}</strong> trial is ending soon—just <strong>${daysText}</strong> left! Wondering what happens next?</p>`
          : `<p>Your <strong>${planName}</strong> subscription is ending soon—just <strong>${daysText}</strong> left!</p>`
      }

      <div class="highlight">
        ${
          isTrialing
            ? `<strong>You will be moved back to the free Starter plan</strong>`
            : `<strong>Your subscription will expire on ${expiryDateFormatted}</strong>`
        }
      </div>

      <p>Contacts Management helps you organize, manage, and grow your professional network effortlessly. Don't lose access to your premium features!</p>

      <div class="benefits">
        <p><strong>Why Continue with Contacts Management?</strong></p>
        <ul>
          <li>Unlimited contacts and advanced contact management</li>
          <li>Seamless integrations with Gmail, Outlook, iCloud & more</li>
          <li>Digital business cards and QR code sharing</li>
          <li>Advanced analytics and insights on your network</li>
        </ul>
      </div>

      <p><strong>Ready to continue hassle-free?</strong></p>
      
      <center>
        <a href="https://contacts.management/pricing" class="button">Upgrade Now</a>
      </center>

      <p>Have questions? Reach out anytime—we're happy to help!</p>
      <p><a href="mailto:hello@contacts.management">hello@contacts.management</a></p>

      <p>Cheers!<br><strong>Team Contacts Management</strong></p>
    </div>

    <div class="footer">
      <p style="text-align: center;">
        <a href="https://contacts.management/privacy" target="_blank" style="color: #007bff; text-decoration: none;">Privacy Policy</a>
      </p>
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
            matchedUsers.push({ user, plan, expiresAt, isTrialing });
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
      matchedUsers.map(({ user, plan, expiresAt, isTrialing }) =>
        emailLimiter(async () => {
          try {
            const planName = plan?.name || "Starter";
            const expiryDateFormatted =
              moment(expiresAt).format("MMMM Do, YYYY");

            // Calculate days left
            const daysLeft = moment(expiresAt).diff(moment(), "days");

            const emailHtml = generateExpiryEmailTemplate(
              user,
              planName,
              expiryDateFormatted,
              daysLeft,
              isTrialing
            );

            await sendEmail(
              user.email,
              isTrialing
                ? "Your Trial is Ending Soon"
                : "Your Subscription is About to Expire",
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
