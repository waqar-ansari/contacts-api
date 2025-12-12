const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    // service: 'smtp',
    // host: "smtp.titan.email", // SMTP server address
    // port: 465, // Port for secure connection
    // secure: true, // Use SSL/TLS
    // auth: {
    //   user: 'noreply@contacts.management', // your Gmail address
    //   pass: 'bZ}JTus_PQ{qWvA'     // app password from Google
    //   // user: "makvanayash12@gmail.com",
    //   // pass: "fybb lnri tmrq otmg",
    // },
    service: "gmail", // Use your SMTP service
    host: "smtp.gmail.com", // SMTP server address
    port: 465, // Port for secure connection
    secure: true, // Use SSL/TLS
    auth: {
      user: "makvanayash2112@gmail.com",
      pass: "wngq xqyd fkcf kbyl", // App Password, not normal password
    },
    tls: {
      rejectUnauthorized: false  // THIS LINE FIXES THE ERROR
    }
  });

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

  await transporter.sendMail({
    from: '"Contacts Management" <noreply@contacts.management>',
    to,
    subject,
    html
  });
};

module.exports = sendEmail;
