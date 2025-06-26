// const nodemailer = require("nodemailer");

// const transporter = nodemailer.createTransport({
//   service: "Gmail", // or use your SMTP config
//   auth: {
//     user: "makvanayash12@gmail.com",
//     pass: "fybb lnri tmrq otmg",
//   },
// });

// const sendVerificationEmail = async (email, link) => {
//   const mailOptions = {
//     from: '"YourApp" <makvanayash12@gmail.com>',
//     to: email,
//     subject: "Verify your email address",
//     html: `<p>Click the link below to verify your email:</p><a href="${link}">Verify Email</a>`,
//   };

//   await transporter.sendMail(mailOptions);
// };

// module.exports = { sendVerificationEmail };

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "makvanayash12@gmail.com",
    pass: "fybb lnri tmrq otmg", // App Password, not normal password
  },
});

const sendVerificationEmail = async (email, link) => {
  const mailOptions = {
    from: '"Contacts Management" <noreplay@contactmanagemant.com>',
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

