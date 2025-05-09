const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'makvanayash12@gmail.com', // your Gmail address
      pass: 'fybb lnri tmrq otmg'     // app password from Google
    },
    tls: {
      rejectUnauthorized: false  // THIS LINE FIXES THE ERROR
    }
  });

  await transporter.sendMail({
    from: 'makvanayash12@gmail.com',
    to,
    subject,
    html
  });
};

module.exports = sendEmail;
