const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    service: 'smtp',
    host: "smtp.titan.email", // SMTP server address
    port: 465, // Port for secure connection
    secure: true, // Use SSL/TLS
    auth: {
      user: 'noreply@contacts.management', // your Gmail address
      pass: 'bZ}JTus_PQ{qWvA'     // app password from Google
      // user: "makvanayash12@gmail.com",
      // pass: "fybb lnri tmrq otmg",
    },
    tls: {
      rejectUnauthorized: false  // THIS LINE FIXES THE ERROR
    }
  });

  await transporter.sendMail({
    from: 'noreply@contacts.management',
    to,
    subject,
    html
  });
};

module.exports = sendEmail;
