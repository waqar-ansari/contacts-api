const nodemailer = require("nodemailer");

/**
 * Send an email using nodemailer
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML content of the email
 */
const sendEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    service: "smtp",
    host: "smtp.titan.email",
    port: 465,
    secure: true,
    auth: {
      user: "noreply@contacts.management",
      pass: "bZ}JTus_PQ{qWvA",
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  await transporter.sendMail({
    from: '"Contacts Management" <noreply@contacts.management>',
    to,
    subject,
    html,
  });
};

module.exports = sendEmail;
