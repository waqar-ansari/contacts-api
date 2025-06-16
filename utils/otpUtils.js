const crypto = require("crypto");
const nodemailer = require("nodemailer");

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// === Email Transporter (Nodemailer with Gmail) ===
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "makvanayash12@gmail.com",
    pass: "fybb lnri tmrq otmg", // Use Gmail App Password
  },
});

async function sendEmailOtp(email, otp) {
  const mailOptions = {
    from: '"Your App" <makvanayash12@gmail.com>',
    to: email,
    subject: "OTP Verification",
    html: `<p>Your OTP is <b>${otp}</b>. It will expire in 5 minutes.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Email OTP sent to", email);
  } catch (error) {
    console.error("Email send error:", error.message);
  }
}

module.exports = {
  generateOtp,
  sendEmailOtp,
};
