const User = require("../../models/userModel");
const Contact = require("../../models/contactModel");
const { sendMail } = require("../../utils/emailUtils");
const path = require("path");

// Helper: HTML Email Template
function generateWeeklyReportHTML({ logo_url, login_url, unsubscribe_url, lead, scan, card, manual, userFullName }) {
    return `
  <!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Your Weekly Connections Report</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f5f7fa; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding:20px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 8px rgba(0,0,0,0.05); max-width:600px;">
            
            <tr>
              <td align="center" style="padding:25px 20px 10px 20px; background-color:#ffffff;">
                <img src="${logo_url}" alt="Company Logo" width="150" style="display:block; border:0; outline:none; text-decoration:none;">
              </td>
            </tr>

            <tr>
              <td style="border-top:1px solid #e5e7eb;"></td>
            </tr>

            <tr>
              <td align="left" style="padding:30px 40px 10px 40px;">
                <h2 style="margin:0; color:#111827; font-size:22px; font-weight:700;">Hi ${userFullName}!</h2>
              </td>
            </tr>

            <tr>
              <td align="left" style="padding:0 40px 20px 40px; color:#374151; font-size:15px; line-height:1.6;">
                <p style="margin:0 0 10px 0;">Let’s see how you performed in the past week!</p>
                <p style="margin:0 0 20px 0;">Below is the total number of connections for you have made.<br>Login to see your activity.</p>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:0 40px 30px 40px;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse; background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:8px;">
                  <thead>
                    <tr style="background-color:#0b76ff; color:#ffffff; text-align:left;">
                      <th style="padding:12px 16px; font-size:15px;">Details</th>
                      <th style="padding:12px 16px; font-size:15px;">Entries</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style="padding:12px 16px; border-top:1px solid #e5e7eb;">New Lead</td>
                      <td style="padding:12px 16px; border-top:1px solid #e5e7eb;">${lead}</td>
                    </tr>
                    <tr style="background-color:#f3f4f6;">
                      <td style="padding:12px 16px; border-top:1px solid #e5e7eb;">QR Scan</td>
                      <td style="padding:12px 16px; border-top:1px solid #e5e7eb;">${scan}</td>
                    </tr>
                    <tr>
                      <td style="padding:12px 16px; border-top:1px solid #e5e7eb;">Business Card Scan</td>
                      <td style="padding:12px 16px; border-top:1px solid #e5e7eb;">${card}</td>
                    </tr>
                    <tr style="background-color:#f3f4f6;">
                      <td style="padding:12px 16px; border-top:1px solid #e5e7eb;">Manual Entry</td>
                      <td style="padding:12px 16px; border-top:1px solid #e5e7eb;">${manual}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:0 40px 30px 40px;">
                <a href="${login_url}" target="_blank" style="display:inline-block; background-color:#0b76ff; color:#ffffff; text-decoration:none; font-size:16px; font-weight:600; padding:12px 28px; border-radius:6px;">
                  Login to View Details
                </a>
              </td>
            </tr>

            <tr>
              <td align="left" style="padding:0 40px 30px 40px; color:#4b5563; font-size:15px; line-height:1.6;">
                <p style="margin:0 0 8px 0;">Grow your network seamlessly!</p>
                <p style="margin:0;">Happy Connecting 💫<br><strong>The Contacts Management Team</strong></p>
              </td>
            </tr>

            <tr>
              <td style="background-color:#f9fafb; padding:16px 40px; text-align:center; color:#9ca3af; font-size:12px;">
                © 2025 Contacts Management. All rights reserved.<br>
                <a href="${unsubscribe_url}" style="color:#9ca3af; text-decoration:underline;">Unsubscribe</a>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

// Controller
exports.sendWeeklyReport = async (req, res) => {
    try {
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - 7);

        const endOfWeek = new Date();

        // Fetch all users
        const users = await User.find({ email: { $exists: true, $ne: null } });

        if (!users.length) {
            return res.status(404).json({ message: "No users found" });
        }

        for (const user of users) {
            const userId = user._id;
            const userFullName = `${user.firstname || ""} ${user.lastname || ""}`.trim() || "User";
            // Count contacts added this week by category
            const categories = ["lead", "scan", "card", "manual"];
            const counts = {};

            for (const cat of categories) {
                counts[cat] = await Contact.countDocuments({
                    createdBy: userId,
                    category: cat,
                    createdAt: { $gte: startOfWeek, $lte: endOfWeek },
                });
            }

            // Prepare email
            const html = generateWeeklyReportHTML({
                logo_url: "https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/logoWithName.png",
                login_url: "https://contacts-user-web.vercel.app/login",
                unsubscribe_url: "https://contacts-user-web.vercel.app/unsubscribe",
                userFullName,
                lead: counts.lead || 0,
                scan: counts.scan || 0,
                card: counts.card || 0,
                manual: counts.manual || 0,
            });

            const mailOptions = {
                from: '"Contacts Management" <noreply@contacts.management>',
                to: user.email,
                subject: "Your Weekly Connections Report",
                html,
            };

            try {
                await sendMail(mailOptions);
                console.log(`✅ Weekly report sent to: ${user.email}`);
            } catch (emailErr) {
                console.error(`❌ Failed to send email to ${user.email}:`, emailErr.message);
            }
        }

        res.status(200).json({ message: "Weekly reports sent successfully!" });
    } catch (error) {
        console.error("Error sending weekly reports:", error);
        res.status(500).json({ error: error.message });
    }
};
