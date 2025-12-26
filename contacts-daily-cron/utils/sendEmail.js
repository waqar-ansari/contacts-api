const nodemailer = require("nodemailer");

/**
 * Send an email using nodemailer
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML content of the email
 */
const sendEmail = async (to, subject, html) => {
  // const transporter = nodemailer.createTransport({
  //   service: "smtp",
  //   host: "smtp.titan.email",
  //   port: 465,
  //   secure: true,
  //   auth: {
  //     user: "noreply@contacts.management",
  //     pass: "bZ}JTus_PQ{qWvA",
  //   },
  //   tls: {
  //     rejectUnauthorized: false,
  //   },
  // });

  const transporter = nodemailer.createTransport({
    service: "smtp", // Use your SMTP service
    host: "email-smtp.eu-north-1.amazonaws.com", // SMTP server address
    port: 587, // Port for secure connection
    secure: false, // Use SSL/TLS
    auth: {
      user: "AKIAZPPGACVJJ6IDCLWH",
      pass: "BI2f1DBxTOVGOaW04FdAEzG+aE6QBDYNF3h4+Xl65uYF", // App Password, not normal password
    },
    // optional TLS options:
    tls: {
      // do not fail on invalid certs in dev (remove in prod)
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
