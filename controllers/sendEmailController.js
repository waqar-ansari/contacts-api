const nodemailer = require('nodemailer');

// Your fixed backend SMTP config
const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 465;
const SMTP_USER = 'makvanayash12@gmail.com';
const SMTP_PASS = 'fybb lnri tmrq otmg';

// const SMTP_HOST = 'smtp.titan.email';
// const SMTP_PORT = 465;
// const SMTP_USER = 'noreply@contacts.management';
// const SMTP_PASS = 'bZ}JTus_PQ{qWvA';

exports.sendEmail = async (req, res) => {
    const { from, to, subject, text, html } = req.body;

    try {
        // Create transporter
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_PORT == 465,
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS,
            },
        });

        // Build the "from" address (show requested name but actual SMTP user for deliverability)
        const mailFrom = from
            ? `"${from}" <${SMTP_USER}>`
            : SMTP_USER;  // If user didn't send from, fallback to SMTP user email

        // Send email
        const info = await transporter.sendMail({
            from: mailFrom,
            to,
            subject,
            text,
            html,
            replyTo: from || undefined,  // Optional: replies go back to user's from email
        });

        res.json({ status: 'success', message: 'Email sent successfully' });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to send email',
            error: error.message,
        });
    }
};
