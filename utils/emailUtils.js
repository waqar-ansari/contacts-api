const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "smtp", // Use your SMTP service
  host: "smtp.titan.email", // SMTP server address
  port: 465, // Port for secure connection
  secure: true, // Use SSL/TLS
  auth: {
    user: "noreply@contacts.management",
    pass: "bZ}JTus_PQ{qWvA", // App Password, not normal password
    // user: "makvanayash12@gmail.com",
    // pass: "fybb lnri tmrq otmg", // App Password, not normal password
  },
  // optional TLS options:
  tls: {
    // do not fail on invalid certs in dev (remove in prod)
    rejectUnauthorized: false,
  },
});

function sendMail(mailOptions) {
  return transporter.sendMail(mailOptions);
}

const sendVerificationEmail = async (email, link) => {
  const mailOptions = {
    from: '"Contacts Management" <noreply@contacts.management>',
    to: email,
    subject: "Contacts.Management : Verify Your E-mail",
    html: `<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>Verify Your Contacts Management Account</title>
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

        .social-icons img {
            width: 30px;
            margin: 0 5px;
            vertical-align: middle;
        }

        .app-buttons img {
            width: 120px;
            margin: 10px 5px;
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
    </style>
</head>

<body>
    <div class="container">

        <center> <img src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/logoWithName.png"
                    alt="Contacts Management Logo" style="width:200px; display:block;"></center>
        <p><strong>Hello,</strong></p>
        
        <p>Congratulations on creating your <strong>Contacts Management CRM</strong> account — a powerful step toward
            organizing, connecting, and growing your professional network.</p>

        <p>To ensure the security of your account and activate all features, please verify your email address:</p>

        <p><span style="font-size:18px;">👉</span> <a href="${link}" style="color:#007bff;text-decoration:none;">${link}</a></p>

        <p>We look forward to helping you along your journey!</p>

        <p>If you didn't sign up for this account, please ignore this email.</p>

        <p>Warm regards,<br>Contacts Management</p>

        <center><a href="${link}" class="button">VERIFY MY ACCOUNT</a></center>


        <p></p>

        <div style="width:100%; overflow:hidden;">

            <!-- Left Column (Image) -->
            <div style="float:left; width:110px; margin-right:10px;">
                <img src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/logo.png"
                    alt="Contacts Management Logo" style="width:100px; display:block;">
            </div>

            <!-- Right Column (Text) -->
            <br>
            <div style="overflow:hidden;">

                <span style="color:rgb(45,49,58); font-size:14px; letter-spacing:0.25px;">Be Extraordinary,</span><br>

                <span>
                    <b>Contacts Management Team</b><br>
                    <a href="https://contacts.management" target="_blank" style="color:#007BFF; text-decoration:none;">
                        https://contacts.management
                    </a>
                </span>

            </div>

        </div>



        <div class="footer">
            <p>Follow Contacts Management social media on:</p>
            <div class="social-icons">
                <a href="#"><img
                        src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/facebookIcon.png"
                        alt="Facebook"></a>
                <a href="#"><img src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/instagramIcon.png"
                        alt="Instagram"></a>
                <a href="#"><img src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/linkedinIcon.png"
                        alt="linkedin"></a>
                <a href="#"><img
                        src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/twitterIcon.png"
                        alt="Twitter"></a>
                <a href="#"><img
                        src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/youtubeIcon.png"
                        alt="YouTube"></a>
            </div>
            <br><br>
            <div class="app-buttons">
                <p>Download the Contacts Managementt App:</p>
                <a href="#"><img
                        src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/appStoreIcon.png"
                        alt="App Store"></a>
                <a href="#"><img
                        src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/playStoreIcon.png"
                        alt="Google Play"></a>
            </div>

            <p>Need help? Visit <a href="#">support@contacts.management</a> </p>
            <p>Sent with ❤️ from Contacts Management</p>
            <p><a href="#" target="_blank">Privacy Policy</a></p>
        </div>
    </div>
</body>

</html>`,
  };

  await transporter.sendMail(mailOptions);
};

const sendHelpSupportReply = async (
  userEmail,
  userName,
  originalMessage,
  adminReply,
  subject
) => {
  const mailOptions = {
    from: '"Contacts Management Support" <noreply@contacts.management>',
    to: userEmail,
    subject: `Re: ${subject || "Your Support Request"}`,
    html: `<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>Support Response - Contacts Management</title>
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

        .response-box {
            background-color: #f8f9fa;
            border-left: 4px solid #007bff;
            padding: 15px;
            margin: 20px 0;
        }

        .original-message {
            background-color: #e9ecef;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
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
    </style>
</head>

<body>
    <div class="container">
        <center>
            <img src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/logoWithName.png"
                alt="Contacts Management Logo" style="width:200px; display:block;">
        </center>
        
        <p><strong>Hello ${userName || "Valued Customer"},</strong></p>
        
        <p>Thank you for contacting Contacts Management support. We have reviewed your inquiry and are pleased to provide you with the following response:</p>

        <div class="response-box">
            <h3 style="color: #007bff; margin-top: 0;">Support Response:</h3>
            <p style="white-space: pre-wrap;">${adminReply}</p>
        </div>

        <div class="original-message">
            <h4 style="margin-top: 0;">Your Original Message:</h4>
            <p style="white-space: pre-wrap;">${originalMessage}</p>
        </div>

        <p>If you have any additional questions or concerns, please don't hesitate to reach out to us again. We're here to help!</p>

        <p>Best regards,<br>Contacts Management Support Team</p>

        <div style="width:100%; overflow:hidden; margin-top: 30px;">
            <div style="float:left; width:110px; margin-right:10px;">
                <img src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/logo.png"
                    alt="Contacts Management Logo" style="width:100px; display:block;">
            </div>
            <div style="overflow:hidden;">
                <span style="color:rgb(45,49,58); font-size:14px; letter-spacing:0.25px;">Be Extraordinary,</span><br>
                <span>
                    <b>Contacts Management Support Team</b><br>
                    <a href="https://contacts.management" target="_blank" style="color:#007BFF; text-decoration:none;">
                        https://contacts.management
                    </a>
                </span>
            </div>
        </div>

        <div class="footer">
            <p>Need additional help? Contact us at <a href="mailto:support@contacts.management">support@contacts.management</a></p>
            <p>Sent with ❤️ from Contacts Management</p>
            <p><a href="#" target="_blank">Privacy Policy</a></p>
        </div>
    </div>
</body>

</html>`,
  };

  await transporter.sendMail(mailOptions);
};

const sendHelpSupportReplyNotification = async (
  userEmail,
  userName,
  subject,
  adminMessage,
  ticketId
) => {
  const ticketsPageUrl = `${process.env.FRONTEND_URL || "https://contacts.management"
    }/my-tickets?ticketId=${ticketId}`;

  const mailOptions = {
    from: '"Contacts Management Support" <noreply@contacts.management>',
    to: userEmail,
    subject: `New Reply: ${subject || "Your Support Request"}`,
    html: `<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>New Reply - Contacts Management</title>
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

        .notification-box {
            background-color: #e8f5e8;
            border-left: 4px solid #28a745;
            padding: 15px;
            margin: 20px 0;
        }

        .message-box {
            background-color: #f8f9fa;
            border-left: 4px solid #007bff;
            padding: 15px;
            margin: 20px 0;
        }

        .cta-button {
            display: inline-block;
            background-color: #007bff;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
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
    </style>
</head>

<body>
    <div class="container">
        <center>
            <img src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/logoWithName.png"
                alt="Contacts Management Logo" style="width:200px; display:block;">
        </center>
        
        <p><strong>Hello ${userName || "Valued Customer"},</strong></p>
        
        <div class="notification-box">
            <h3 style="color: #28a745; margin-top: 0;">🎉 You've received a new reply!</h3>
            <p>Our support team has responded to your ticket: <strong>${subject}</strong></p>
        </div>

        <div class="message-box">
            <h4 style="color: #007bff; margin-top: 0;">Latest Reply:</h4>
            <p style="white-space: pre-wrap;">${adminMessage}</p>
        </div>

        <center>
            <a href="${ticketsPageUrl}" class="cta-button" style="color: white;">View Conversation & Reply</a>
        </center>

        <p>Click the button above to view the full conversation and continue chatting with our support team.</p>

        <p>Best regards,<br>Contacts Management Support Team</p>

        <div style="width:100%; overflow:hidden; margin-top: 30px;">
            <div style="float:left; width:110px; margin-right:10px;">
                <img src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/logo.png"
                    alt="Contacts Management Logo" style="width:100px; display:block;">
            </div>
            <div style="overflow:hidden;">
                <span style="color:rgb(45,49,58); font-size:14px; letter-spacing:0.25px;">Be Extraordinary,</span><br>
                <span>
                    <b>Contacts Management Support Team</b><br>
                    <a href="https://contacts.management" target="_blank" style="color:#007BFF; text-decoration:none;">
                        https://contacts.management
                    </a>
                </span>
            </div>
        </div>

        <div class="footer">
            <p>Need additional help? Contact us at <a href="mailto:support@contacts.management">support@contacts.management</a></p>
            <p>Sent with ❤️ from Contacts Management</p>
            <p><a href="#" target="_blank">Privacy Policy</a></p>
        </div>
    </div>
</body>

</html>`,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Build a vCard string from a user object.
 * ownerUser expected shape: {
 *   firstname, lastname, email, phonenumbers: [{ countryCode, number }], linkedin, instagram, telegram, twitter, facebook, company, designation
 * }
 */
function buildVCard(ownerUser) {
  const fn = `${ownerUser.firstname || ""} ${ownerUser.lastname || ""}`.trim();
  const n = `${ownerUser.lastname || ""};${ownerUser.firstname || ""};;;`;
  const email = ownerUser.email || "";
  const phones = Array.isArray(ownerUser.phonenumbers)
    ? ownerUser.phonenumbers
    : [];
  const telLines = phones
    .map((p) => {
      // phone.type fallback to VOICE
      const full = (p.countryCode ? `+${p.countryCode}` : "") + (p.number || "");
      return full ? `TEL;TYPE=CELL:${full}` : "";
    })
    .filter(Boolean)
    .join("\n");

  const url = ownerUser.website || ownerUser.linkedin || "";
  const org = ownerUser.company || "";
  const title = ownerUser.designation || "";

  // Simple vCard v3.0
  let vcard = `BEGIN:VCARD
VERSION:3.0
FN:${escapeVC(fn)}
N:${escapeVC(n)}
`;

  if (email) vcard += `EMAIL;TYPE=INTERNET:${escapeVC(email)}\n`;
  if (telLines) vcard += `${telLines}\n`;
  if (org) vcard += `ORG:${escapeVC(org)}\n`;
  if (title) vcard += `TITLE:${escapeVC(title)}\n`;
  if (url) vcard += `URL:${escapeVC(url)}\n`;

  // social links as NOTE
  const socials = [];
  if (ownerUser.linkedin) socials.push(`LinkedIn: ${ownerUser.linkedin}`);
  if (ownerUser.instagram) socials.push(`Instagram: ${ownerUser.instagram}`);
  if (ownerUser.twitter) socials.push(`Twitter: ${ownerUser.twitter}`);
  if (ownerUser.telegram) socials.push(`Telegram: ${ownerUser.telegram}`);
  if (ownerUser.facebook) socials.push(`Facebook: ${ownerUser.facebook}`);
  if (socials.length) vcard += `NOTE:${escapeVC(socials.join(" | "))}\n`;

  vcard += `REV:${new Date().toISOString()}\nEND:VCARD`;

  return vcard;
}

function escapeVC(str = "") {
  return String(str).replace(/\n/g, "\\n").replace(/,/g, "\\,");
}

/**
 * HTML template for Owner (UserID) notification when someone adds/saves their profile (temp user).
 * tempUser object shape { firstname, lastname, email, phonenumber, countryCode, createdAt, linkedin, instagram, telegram, twitter, facebook }
 */
// function ownerHtmlTemplate(ownerUser, tempUser) {
//     const tempName = `${tempUser.firstname || ""} ${tempUser.lastname || ""}`.trim();
//     const phone = tempUser.phonenumber
//         ? `${tempUser.countryCode ? "+" + tempUser.countryCode + " " : ""}${tempUser.phonenumber}`
//         : "Not provided";
//     const createdAt = tempUser.createdAt ? new Date(tempUser.createdAt).toLocaleString() : new Date().toLocaleString();

//     return `<!doctype html>
// <html>
// <head>
// <meta charset="utf-8" />
// <title>Someone saved your profile — Contacts Management</title>
// <style>
//   body { font-family: Arial, sans-serif; color:#2d313a; background:#fff; margin:0; padding:0; }
//   .container{max-width:600px;margin:20px auto;padding:20px;border:1px solid #e9ecef;border-radius:8px;}
//   .header{ text-align:center; margin-bottom:15px;}
//   .button{ display:inline-block; padding:10px 16px; border-radius:6px; text-decoration:none; background:#007bff; color:#fff; font-weight:600;}
//   .row{ margin:12px 0;}
//   .label{ color:#6c757d; font-size:13px;}
// </style>
// </head>
// <body>
//   <div class="container">
//     <div class="header">
//       <img src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/logoWithName.png" alt="Contacts Management" style="width:180px;">
//     </div>

//     <p><strong>Hi ${ownerUser.firstname || "there"},</strong></p>

//     <p>${tempName || "Someone"} just added/saved your shared profile (temporary entry) on Contacts Management on <strong>${createdAt}</strong>.</p>

//     <div class="row"><div class="label">Name</div><div>${escapeHtml(tempName) || "-"}</div></div>
//     <div class="row"><div class="label">Email</div><div>${escapeHtml(tempUser.email || "Not provided")}</div></div>
//     <div class="row"><div class="label">Phone</div><div>${escapeHtml(phone)}</div></div>
//     ${tempUser.linkedin ? `<div class="row"><div class="label">LinkedIn</div><div>${escapeHtml(tempUser.linkedin)}</div></div>` : ""}
//     <p>If you'd like to review or remove this temporary entry, open your Contacts Management dashboard.</p>

//     <p>Warm regards,<br/>Contacts Management Team</p>

//     <div style="text-align:center;margin-top:18px;">
//       <a class="button" href="https://contacts.management">Open Dashboard</a>
//     </div>
//   </div>
// </body>
// </html>`;
// }

function ownerHtmlTemplate(ownerUser, tempUser) {
  const tempName = `${tempUser.firstname || ""} ${tempUser.lastname || ""}`.trim();
  const phone = tempUser.phonenumber
    ? `${tempUser.countryCode ? "+" + tempUser.countryCode + " " : ""}${tempUser.phonenumber}`
    : "Not provided";
  const createdAt = tempUser.createdAt
    ? new Date(tempUser.createdAt).toLocaleString()
    : new Date().toLocaleString();

  const escapeHtml = (unsafe) =>
    unsafe
      ? unsafe.replace(/[&<"'>]/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[m]))
      : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Contact Information</title>
    <style>
      body {
        font-family: 'Segoe UI', Arial, sans-serif;
        background-color: #f5f7fa;
        margin: 0;
        padding: 0;
        color: #333333;
      }

      .email-container {
        max-width: 600px;
        margin: 30px auto;
        background: #ffffff;
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
      }

      .email-header {
        background-color: #0052cc;
        text-align: center;
        padding: 20px;
      }

      .email-header img {
        max-width: 140px;
      }

      .email-body {
        padding: 30px;
      }

      .email-body h2 {
        font-size: 20px;
        color: #222222;
        margin-bottom: 15px;
      }

      .email-body p {
        font-size: 15px;
        line-height: 1.6;
        margin: 8px 0;
      }

      .info-box {
        background-color: #f1f5ff;
        border-left: 4px solid #0052cc;
        padding: 15px 20px;
        border-radius: 6px;
        margin: 20px 0;
      }

      .info-item {
        margin: 8px 0;
        font-size: 15px;
      }

      .info-label {
        font-weight: 600;
        color: #0052cc;
        margin-right: 5px;
      }

      .email-footer {
        background-color: #f0f0f0;
        text-align: center;
        padding: 15px;
        font-size: 13px;
        color: #777777;
      }

      a.button {
        display: inline-block;
        margin-top: 15px;
        background-color: #0052cc;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        text-decoration: none;
        font-weight: 500;
      }

      a.button:hover {
        background-color: #003d99;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <!-- Header with logo -->
      <div class="email-header">
        <img src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/logoWithName.png" alt="Contacts Management Logo" />
      </div>

      <!-- Email Body -->
      <div class="email-body">
        <h2>Hi <strong>${escapeHtml(ownerUser.firstname || "there")}</strong>,</h2>

        <p>
          <strong>${escapeHtml(tempName || "Someone")}</strong> has sent you contact information as below:
        </p>

        <div class="info-box">
          <div class="info-item">
            <span class="info-label">Name:</span> ${escapeHtml(tempName) || "-"}
          </div>
          <div class="info-item">
            <span class="info-label">Email:</span> ${escapeHtml(tempUser.email || "Not provided")}
          </div>
          <div class="info-item">
            <span class="info-label">Mobile:</span> ${escapeHtml(phone)}
          </div>
          ${tempUser.linkedin
      ? `<div class="info-item"><span class="info-label">LinkedIn:</span> ${escapeHtml(tempUser.linkedin)}</div>`
      : ""
    }
        </div>

        <p>
          If you'd like to review, please log in to your
          <a href="https://contacts-user-web.vercel.app/" target="_blank">Contacts Management</a>
          dashboard.
        </p>

        <a href="https://contacts-user-web.vercel.app/" class="button">Go to Dashboard</a>

        <p style="margin-top: 25px;">
          Warm regards,<br />
          <strong>Contacts Management Team</strong>
        </p>
      </div>

      <!-- Footer -->
      <div class="email-footer">
        © 2025 Contacts Management. All rights reserved.
      </div>
    </div>
  </body>
</html>`;
}


/**
 * HTML template for Scanner (temp user) email that includes owner's profile summary and mention of attached vCard.
 */
// function scannerHtmlTemplate(ownerUser) {
//     const ownerName = `${ownerUser.firstname || ""} ${ownerUser.lastname || ""}`.trim();
//     const phoneObj = Array.isArray(ownerUser.phonenumbers) && ownerUser.phonenumbers[0];
//     const phone = phoneObj ? `${phoneObj.countryCode ? "+" + phoneObj.countryCode + " " : ""}${phoneObj.number}` : "Not provided";
//     return `<!doctype html>
// <html>
// <head>
// <meta charset="utf-8" />
// <title>Profile shared with you — Contacts Management</title>
// <style>
//   body { font-family: Arial, sans-serif; color:#2d313a; background:#fff; margin:0; padding:0; }
//   .container{max-width:600px;margin:20px auto;padding:20px;border:1px solid #e9ecef;border-radius:8px;}
//   .header{ text-align:center; margin-bottom:15px;}
//   .button{ display:inline-block; padding:10px 16px; border-radius:6px; text-decoration:none; background:#007bff; color:#fff; font-weight:600;}
//   .row{ margin:12px 0;}
//   .label{ color:#6c757d; font-size:13px;}
// </style>
// </head>
// <body>
//   <div class="container">
//     <div class="header">
//       <img src="https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/logoWithName.png" alt="Contacts Management" style="width:180px;">
//     </div>

//     <p><strong>Hi,</strong></p>

//     <p>You just saved the profile of <strong>${escapeHtml(ownerName) || "-"}</strong> on Contacts Management. We attached their contact as a <strong>vCard (.vcf)</strong> for easy import into your phone or address book.</p>

//     <div class="row"><div class="label">Name</div><div>${escapeHtml(ownerName) || "-"}</div></div>
//     <div class="row"><div class="label">Email</div><div>${escapeHtml(ownerUser.email || "Not provided")}</div></div>
//     <div class="row"><div class="label">Phone</div><div>${escapeHtml(phone)}</div></div>

//     <p>To import the vCard: download the attachment and open it on your device.</p>

//     <p>Warm regards,<br/>Contacts Management Team</p>

//     <div style="text-align:center;margin-top:18px;">
//       <a class="button" href="https://contacts.management">Open App</a>
//     </div>
//   </div>
// </body>
// </html>`;
// }

function scannerHtmlTemplate(ownerUser, tempUser, vcfDownloadUrl) {
  const ownerName = `${ownerUser.firstname || ""} ${ownerUser.lastname || ""}`.trim();
  const tempName = `${tempUser.firstname || ""} ${tempUser.lastname || ""}`.trim() || "there";

  const phoneObj =
    Array.isArray(ownerUser.phonenumbers) && ownerUser.phonenumbers[0];
  const phone = phoneObj
    ? `${phoneObj.countryCode ? "+" + phoneObj.countryCode + " " : ""}${phoneObj.number}`
    : "Not provided";

  const escapeHtml = (unsafe) =>
    unsafe
      ? unsafe.replace(/[&<"'>]/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[m]))
      : "";

  const logoUrl =
    "https://contacts-api-bucket.s3.eu-north-1.amazonaws.com/iconsAndImages/logoWithName.png";
  const registerUrl = "https://contacts-user-web.vercel.app/register";
  const unsubscribeUrl = "https://contacts-user-web.vercel.app/unsubscribe";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Contact vCard</title>
</head>

<body style="margin:0; padding:0; background-color:#f4f6f8;">
  <!-- Outer wrapper -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f6f8;">
    <tr>
      <td align="center" style="padding:20px;">
        <!-- Email container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600"
          style="max-width:600px; background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.05);">

          <!-- Header / Logo -->
          <tr>
            <td align="center" style="padding:20px 24px 10px 24px; background-color:#ffffff;">
              <img src="${logoUrl}" alt="Contacts Management Logo" width="160"
                style="display:block; border:0; outline:none; text-decoration:none;">
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="border-top:1px solid #eef0f2;"></td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:28px 32px 18px 32px; font-family:system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#1f2937; line-height:1.5;">
              
              <p style="margin:0 0 18px 0; font-size:16px;">
                Hi <strong>${escapeHtml(tempName)}</strong>,
              </p>

              <p style="margin:0 0 18px 0; font-size:15px; color:#374151;">
                Thanks for sharing your contact details with <strong>${escapeHtml(ownerName)}</strong>.
                We've attached their vCard (.vcf) for your reference — click the button below to
                download and save it to your contacts.
              </p>

              <!-- Download button -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:18px 0 22px 0;">
                <tr>
                  <td align="center">
                    <a href="${vcfDownloadUrl}" target="_blank"
                      style="display:inline-block;padding:12px 22px;border-radius:6px;background-color:#5D6064;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;font-family:inherit;">
                      Download vCard
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px 0; font-size:15px; color:#374151;">
                Want your own sharable contact card? Create a free profile and start connecting in seconds.
              </p>

              <!-- Register button -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:12px 0 0 0;">
                <tr>
                  <td align="center">
                    <a href="${registerUrl}" target="_blank"
                      style="display:inline-block;padding:12px 22px;border-radius:6px;background-color:#000000;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;font-family:inherit;">
                      Register Now — It’s Free
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:22px 0 0 0; font-size:14px; color:#6b7280;">
                Thank you,<br>
                <strong>The Contacts Management Team</strong>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#fafafa; padding:16px 32px; font-family:system-ui, -apple-system, 'Segoe UI', Roboto, Arial; font-size:12px; color:#9ca3af; text-align:center;">
              <p style="margin:0 0 6px 0;">If you prefer not to receive these emails, you can 
                <a href="${unsubscribeUrl}" style="color:#6b7280; text-decoration:underline;">unsubscribe</a>.
              </p>
              <p style="margin:6px 0 0 0;">Contacts Management • India</p>
            </td>
          </tr>

        </table>
        <!-- End container -->
      </td>
    </tr>
  </table>
</body>
</html>`;
}


// function escapeHtml(str = "") {
//     return String(str)
//         .replace(/&/g, "&amp;")
//         .replace(/</g, "&lt;")
//         .replace(/>/g, "&gt;");
// }

/**
 * Send notification to the UserID owner informing them that a temp user (or any scanner) saved/added their profile.
 * ownerEmail: string
 * tempUser: object (firstname, lastname, email, phonenumber, countryCode, linkedin...)
 */
async function sendOwnerNotification(ownerEmail, ownerUser, tempUser) {
  if (!ownerEmail) return;
  const html = ownerHtmlTemplate(ownerUser, tempUser);
  const mailOptions = {
    from: '"Contacts Management" <noreply@contacts.management>',
    to: ownerEmail,
    subject: "you have a new lead in contacts management - " + `${tempUser.firstname || ""} ${tempUser.lastname || ""}`,
    html,
  };

  return transporter.sendMail(mailOptions);
}

/**
 * Send the ownerUser's profile + vCard to recipientEmail (scanner).
 * recipientEmail: string
 * ownerUser: the user object whose profile will be sent (UserID user)
 */
async function sendProfileAndVcard(recipientEmail, ownerUser, tempUser) {
  if (!recipientEmail) return;

  // pass both users into HTML template
  const html = scannerHtmlTemplate(ownerUser, tempUser);
  const vcardString = buildVCard(ownerUser);
  const vcardBuffer = Buffer.from(vcardString, "utf-8");

  const mailOptions = {
    from: '"Contacts Management" <noreply@contacts.management>',
    to: recipientEmail,
    subject: `Thank you for connecting with ${ownerUser.firstname || ""} ${ownerUser.lastname || ""} — download contact information`,
    html,
    attachments: [
      {
        filename: `${(ownerUser.firstname || "contact")}_${(ownerUser.lastname || "")}.vcf`.replace(/\s+/g, "_"),
        content: vcardBuffer,
        contentType: "text/vcard",
      },
    ],
  };

  return transporter.sendMail(mailOptions);
}




module.exports = {
  sendVerificationEmail,
  sendHelpSupportReply,
  sendHelpSupportReplyNotification,
  transporter,
  sendMail,
  sendOwnerNotification,
  sendProfileAndVcard,
  buildVCard,
};
