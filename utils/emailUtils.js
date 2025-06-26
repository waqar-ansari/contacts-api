const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "smtp",
  auth: {
    user: "noreply@contacts.management",
    pass: "bZ}JTus_PQ{qWvA", // App Password, not normal password
  },
});

const sendVerificationEmail = async (email, link) => {
  const mailOptions = {
    from: '"Contacts Management" <noreply@contacts.management>',
    to: email,
    subject: "Verify Your Email",
    html: `
      <p>Hello,</p>
      <p>Click the button below to verify your email address:</p>
      <a href="${link}" style="padding:10px 20px;background-color:#28a745;color:white;text-decoration:none;border-radius:5px;">Verify Email</a>
      <p>If you didn't request this, please ignore.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendVerificationEmail };

