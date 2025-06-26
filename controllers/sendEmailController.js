const nodemailer = require('nodemailer');

// Your fixed backend SMTP config
const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 465;
const SMTP_USER = 'makvanayash12@gmail.com';
const SMTP_PASS = 'fybb lnri tmrq otmg';

exports.sendEmail = async (req, res) => {
    const { from, to, subject, text, html } = req.body;

    try {
        // Setup transporter
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_PORT == 465, // SSL for 465
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS,
            },
        });

        // Send email
        const info = await transporter.sendMail({
            from,
            to,
            subject,
            text,
            html,
        });

        res.json({ status: 'success', message: 'Email sent successfully' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to send email', error: error.message });
    }
};
