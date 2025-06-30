// const nodemailer = require('nodemailer');

// // Your fixed backend SMTP config
// const SMTP_HOST = 'smtp.gmail.com';
// const SMTP_PORT = 465;
// const SMTP_USER = 'makvanayash12@gmail.com';
// const SMTP_PASS = 'fybb lnri tmrq otmg';

// // const SMTP_HOST = 'smtp.titan.email';
// // const SMTP_PORT = 465;
// // const SMTP_USER = 'noreply@contacts.management';
// // const SMTP_PASS = 'bZ}JTus_PQ{qWvA';

// exports.sendEmail = async (req, res) => {
//     const { from, to, subject, text, html } = req.body;

//     try {
//         // Create transporter
//         const transporter = nodemailer.createTransport({
//             host: SMTP_HOST,
//             port: SMTP_PORT,
//             secure: SMTP_PORT == 465,
//             auth: {
//                 user: SMTP_USER,
//                 pass: SMTP_PASS,
//             },
//         });

//         // Build the "from" address (show requested name but actual SMTP user for deliverability)
//         const mailFrom = from
//             ? `"${from}" <${SMTP_USER}>`
//             : SMTP_USER;  // If user didn't send from, fallback to SMTP user email

//         // Send email
//         const info = await transporter.sendMail({
//             from: mailFrom,
//             to,
//             subject,
//             text,
//             html,
//             replyTo: from || undefined,  // Optional: replies go back to user's from email
//         });

//         res.json({ status: 'success', message: 'Email sent successfully' });
//     } catch (error) {
//         res.status(500).json({
//             status: 'error',
//             message: 'Failed to send email',
//             error: error.message,
//         });
//     }
// };

// const nodemailer = require('nodemailer');
// const { google } = require('googleapis');

// const CLIENT_ID = '690630511368-pfehj1kgnim33509j2d04ok6quinj6vd.apps.googleusercontent.com';
// const CLIENT_SECRET = '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';
// const REDIRECT_URI = 'https://developers.google.com/oauthplayground'; // Or your own redirect URI

// exports.sendEmail = async (req, res) => {
//     const {
//         fromEmail,
//         fromGoogleAccessToken,
//         fromGoogleRefreshToken,
//         to,
//         subject,
//         text,
//         html,
//     } = req.body;

//     if (!fromEmail || !fromGoogleAccessToken || !fromGoogleRefreshToken || !to || !subject) {
//         return res.status(400).json({
//             status: 'error',
//             message: 'Missing required fields. Required: fromEmail, fromGoogleAccessToken, fromGoogleRefreshToken, to, subject',
//         });
//     }

//     try {
//         // Setup OAuth2 client
//         const oAuth2Client = new google.auth.OAuth2(
//             CLIENT_ID,
//             CLIENT_SECRET,
//             REDIRECT_URI
//         );

//         oAuth2Client.setCredentials({
//             refresh_token: fromGoogleRefreshToken,
//         });

//         // Optional: Refresh access token if needed (if frontend sends expired one)
//         const newAccessTokenResponse = await oAuth2Client.getAccessToken();
//         const validAccessToken = newAccessTokenResponse.token || fromGoogleAccessToken;

//         // Nodemailer transporter
//         const transporter = nodemailer.createTransport({
//             service: 'gmail',
//             auth: {
//                 type: 'OAuth2',
//                 user: fromEmail,
//                 clientId: CLIENT_ID,
//                 clientSecret: CLIENT_SECRET,
//                 refreshToken: fromGoogleRefreshToken,
//                 accessToken: validAccessToken,
//             },
//         });

//         const mailOptions = {
//             from: fromEmail,
//             to: to,
//             subject: subject,
//             text: text || '',  // Optional plain text
//             html: html || '',  // Optional HTML body
//         };

//         const info = await transporter.sendMail(mailOptions);

//         res.json({
//             status: 'success',
//             message: 'Email sent successfully',
//             info,
//         });
//     } catch (error) {
//         console.error('Error sending email:', error);
//         res.status(500).json({
//             status: 'error',
//             message: 'Failed to send email',
//             error: error.message,
//         });
//     }
// };

// const nodemailer = require('nodemailer');
// const { google } = require('googleapis');

// const CLIENT_ID = '690630511368-pfehj1kgnim33509j2d04ok6quinj6vd.apps.googleusercontent.com';
// const CLIENT_SECRET = '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';
// const REDIRECT_URI = 'https://developers.google.com/oauthplayground'; // Or your custom redirect URI

// exports.sendEmail = async (req, res) => {
//     const {
//         fromEmail,
//         fromGoogleRefreshToken,
//         to,
//         subject,
//         text,
//         html,
//     } = req.body;

//     if (!fromEmail || !fromGoogleRefreshToken || !to || !subject) {
//         return res.status(400).json({
//             status: 'error',
//             message: 'Missing required fields: fromEmail, fromGoogleRefreshToken, to, subject',
//         });
//     }

//     try {
//         const oAuth2Client = new google.auth.OAuth2(
//             CLIENT_ID,
//             CLIENT_SECRET,
//             REDIRECT_URI
//         );

//         oAuth2Client.setCredentials({
//             refresh_token: fromGoogleRefreshToken,
//         });

//         const accessTokenResponse = await oAuth2Client.getAccessToken();
//         const accessToken = accessTokenResponse.token;

//         if (!accessToken) {
//             return res.status(500).json({
//                 status: 'error',
//                 message: 'Unable to fetch access token using refresh token',
//             });
//         }

//         const transporter = nodemailer.createTransport({
//             service: 'gmail',
//             auth: {
//                 type: 'OAuth2',
//                 user: fromEmail,
//                 clientId: CLIENT_ID,
//                 clientSecret: CLIENT_SECRET,
//                 refreshToken: fromGoogleRefreshToken,
//                 accessToken: accessToken,
//             },
//         });

//         const mailOptions = {
//             from: fromEmail,
//             to,
//             subject,
//             text: text || '',
//             html: html || '',
//         };

//         transporter.sendMail(mailOptions, (error, info) => {
//             if (error) {
//                 console.error('SendMail Error:', error);
//                 return res.status(500).json({
//                     status: 'error',
//                     message: 'Failed to send email',
//                     error: error.toString(),
//                 });
//             }
//             return res.json({
//                 status: 'success',
//                 message: 'Email sent successfully',
//                 info,
//             });
//         });

//     } catch (error) {
//         console.error('Gmail Send API Error:', error);
//         return res.status(500).json({
//             status: 'error',
//             message: 'Unexpected error during sending email',
//             error: error.toString(),
//         });
//     }
// };

const { google } = require('googleapis');
const axios = require('axios');
require("dotenv").config();
const nodemailer = require('nodemailer');
const User = require('../models/userModel');  // Your User model


const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

exports.sendEmail = async (req, res) => {
    const { fromEmail, fromGoogleRefreshToken, to, subject, text, html } = req.body;

    try {
        const oAuth2Client = new google.auth.OAuth2(
            CLIENT_ID,
            CLIENT_SECRET,
            REDIRECT_URI
        );

        oAuth2Client.setCredentials({
            refresh_token: fromGoogleRefreshToken,
        });

        const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

        // Build MIME Email body (to support HTML + text)
        let messageParts = [
            `From: ${fromEmail}`,
            `To: ${to}`,
            `Subject: ${subject}`,
            'Content-Type: text/html; charset=utf-8',
            '',
            html || text || '',  // ✅ Send HTML if available, else text
        ];

        const message = messageParts.join('\n');

        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const response = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
            },
        });

        res.json({
            status: 'success',
            message: 'Email sent via Gmail successfully',
        });

    } catch (error) {
        console.error('Gmail API Send Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to send email via Gmail',
            error: error.toString(),
        });
    }
};


exports.sendEmailMicrosoft = async (req, res) => {
    const { fromEmail, fromMicrosoftAccessToken, to, subject, text, html } = req.body;

    if (!fromEmail || !fromMicrosoftAccessToken || !to || !subject) {
        return res.status(400).json({
            status: 'error',
            message: 'Missing required fields: fromEmail, fromMicrosoftAccessToken, to, subject',
        });
    }

    try {
        const emailContent = {
            message: {
                subject: subject,
                body: {
                    contentType: html ? 'HTML' : 'Text',
                    content: html || text,
                },
                toRecipients: [
                    {
                        emailAddress: {
                            address: to,
                        },
                    },
                ],
                from: {
                    emailAddress: {
                        address: fromEmail,
                    },
                },
            },
            saveToSentItems: true,
        };

        const response = await axios.post(
            'https://graph.microsoft.com/v1.0/me/sendMail',
            emailContent,
            {
                headers: {
                    Authorization: `Bearer ${fromMicrosoftAccessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        res.json({
            status: 'success',
            message: 'Email sent via Microsoft',
        });

    } catch (error) {
        console.error('Microsoft Graph Send Error:', error.response?.data || error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to send email via Microsoft',
            error: error.response?.data || error.message,
        });
    }
};

exports.sendEmailSMTP = async (req, res) => {
    const userId = req.user._id;
    const { to, subject, text, html } = req.body;

    if (!to || !subject) {
        return res.status(400).json({
            status: 'error',
            message: 'Missing required fields: to, subject',
        });
    }

    try {
        // ✅ Fetch user's saved SMTP config
        const user = await User.findById(userId);
        if (!user || !user.smtpConnected || !user.smtpHost || !user.smtpPort || !user.smtpUser || !user.smtpPass) {
            return res.status(400).json({
                status: 'error',
                message: 'SMTP not connected or incomplete SMTP settings for this user',
            });
        }

        // ✅ Create transporter using user's saved SMTP config
        const transporter = nodemailer.createTransport({
            host: user.smtpHost,
            port: user.smtpPort,
            secure: user.smtpSecure,
            auth: {
                user: user.smtpUser,
                pass: user.smtpPass,
            },
        });

        // ✅ Prepare mail options
        const mailOptions = {
            from: `"Contacts Management" <${user.smtpUser}>`,
            to,
            subject,
            text: text || '',
            html: html || '',
        };

        // ✅ Send email
        const info = await transporter.sendMail(mailOptions);

        res.json({
            status: 'success',
            message: 'Email sent via user SMTP successfully',
        });

    } catch (error) {
        console.error('SMTP Send Email Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to send email via SMTP',
            error: error.message,
        });
    }
};