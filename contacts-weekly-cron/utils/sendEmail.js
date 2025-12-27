const nodemailer = require("nodemailer");

// const transporter = nodemailer.createTransport({
//   service: "smtp", // Use your SMTP service
//   host: "smtp.titan.email", // SMTP server address
//   port: 465, // Port for secure connection
//   secure: true, // Use SSL/TLS
//   auth: {
//     user: "noreply@contacts.management",
//     pass: "bZ}JTus_PQ{qWvA", // App Password, not normal password
//   },
//   // optional TLS options:
//   tls: {
//     // do not fail on invalid certs in dev (remove in prod)
//     rejectUnauthorized: false,
//   },
// });

// const transporter = nodemailer.createTransport({
//   service: "smtp", // Use your SMTP service
//   host: "smtp.gmail.com", // SMTP server address
//   port: 587, // Port for secure connection
//   secure: true, // Use SSL/TLS
//   auth: {
//     user: "daaimalisheikh23@gmail.com",
//     pass: "dstv vfwc uqjy qjic", // App Password, not normal password
//   },
//   // optional TLS options:
//   tls: {
//     // do not fail on invalid certs in dev (remove in prod)
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

function sendMail(mailOptions) {
  return transporter.sendMail(mailOptions);
}

module.exports = {

  transporter,
  sendMail
};