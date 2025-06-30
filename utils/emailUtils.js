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
});

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
        <center> <img src="https://contacts.management/wp-content/uploads/2024/12/1.svg" alt=""></center>
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
                <img src="https://contacts.management/wp-content/uploads/2024/12/contacts-500-x-120-px-250-x-250-px.svg"
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
                        src="https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg"
                        alt="Facebook"></a>
                <a href="#"><img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png"
                        alt="Instagram"></a>
                <a href="#"><img
                        src="https://ci3.googleusercontent.com/meips/ADKq_NbZPGDXAu0Emv9YP-ZjPge6Lx8Ot1BFDSPs6nLKb8fg6UebyPKdTp1wg2S1-Di0Psv4zsM8HmRt4HwcUeSOxoTX5x8dVSs9xGWstdwld__JN5HSdIR9=s0-d-e1-ft#http://s46.mindvalley.us/mindvalley/media/images/ico-twitter.png"
                        alt="Twitter"></a>
                <a href="#"><img
                        src="https://upload.wikimedia.org/wikipedia/commons/4/42/YouTube_icon_%282013-2017%29.png"
                        alt="YouTube"></a>
            </div>
            <br><br>
            <div class="app-buttons">
                <p>Download the Contacts Managementt App:</p>
                <a href="#"><img
                        src="https://ci3.googleusercontent.com/meips/ADKq_NbbTO579ABd3_rqhYTPRe1LB5W5bkOPUOiE5a4s7NCrpnxohoiYpU6Rrh7JXnWE56K_J438i86VY_hHHTuewCcARIUrzBkWxtWZcAE7HyE-iParGLl-940=s0-d-e1-ft#http://s81.mindvalley.us/mindvalley/media/images/btn-app-store.png"
                        alt="App Store"></a>
                <a href="#"><img
                        src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
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

module.exports = { sendVerificationEmail };