// const { google } = require('googleapis');
// const axios = require('axios');
// require("dotenv").config();
// const nodemailer = require('nodemailer');
// const User = require('../models/userModel');  // Your User model


// const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
// const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

// exports.sendEmail = async (req, res) => {
//     const { fromEmail, fromGoogleRefreshToken, to, subject, text, html } = req.body;

//     try {
//         const oAuth2Client = new google.auth.OAuth2(
//             CLIENT_ID,
//             CLIENT_SECRET,
//             REDIRECT_URI
//         );

//         oAuth2Client.setCredentials({
//             refresh_token: fromGoogleRefreshToken,
//         });

//         const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

//         // Build MIME Email body (to support HTML + text)
//         let messageParts = [
//             `From: ${fromEmail}`,
//             `To: ${to}`,
//             `Subject: ${subject}`,
//             'Content-Type: text/html; charset=utf-8',
//             '',
//             html || text || '',  // ✅ Send HTML if available, else text
//         ];

//         const message = messageParts.join('\n');

//         const encodedMessage = Buffer.from(message)
//             .toString('base64')
//             .replace(/\+/g, '-')
//             .replace(/\//g, '_')
//             .replace(/=+$/, '');

//         const response = await gmail.users.messages.send({
//             userId: 'me',
//             requestBody: {
//                 raw: encodedMessage,
//             },
//         });

//         res.json({
//             status: 'success',
//             message: 'Email sent via Gmail successfully',
//         });

//     } catch (error) {
//         console.error('Gmail API Send Error:', error);
//         res.status(500).json({
//             status: 'error',
//             message: 'Failed to send email via Gmail',
//             error: error.toString(),
//         });
//     }
// };

// exports.sendEmailMicrosoft = async (req, res) => {
//     const { fromEmail, fromMicrosoftAccessToken, to, subject, text, html } = req.body;

//     if (!fromEmail || !fromMicrosoftAccessToken || !to || !subject) {
//         return res.status(400).json({
//             status: 'error',
//             message: 'Missing required fields: fromEmail, fromMicrosoftAccessToken, to, subject',
//         });
//     }

//     try {
//         const emailContent = {
//             message: {
//                 subject: subject,
//                 body: {
//                     contentType: html ? 'HTML' : 'Text',
//                     content: html || text,
//                 },
//                 toRecipients: [
//                     {
//                         emailAddress: {
//                             address: to,
//                         },
//                     },
//                 ],
//                 from: {
//                     emailAddress: {
//                         address: fromEmail,
//                     },
//                 },
//             },
//             saveToSentItems: true,
//         };

//         const response = await axios.post(
//             'https://graph.microsoft.com/v1.0/me/sendMail',
//             emailContent,
//             {
//                 headers: {
//                     Authorization: `Bearer ${fromMicrosoftAccessToken}`,
//                     'Content-Type': 'application/json',
//                 },
//             }
//         );

//         res.json({
//             status: 'success',
//             message: 'Email sent via Microsoft',
//         });

//     } catch (error) {
//         console.error('Microsoft Graph Send Error:', error.response?.data || error.message);
//         res.status(500).json({
//             status: 'error',
//             message: 'Failed to send email via Microsoft',
//             error: error.response?.data || error.message,
//         });
//     }
// };

// exports.sendEmailSMTP = async (req, res) => {
//     const userId = req.user._id;
//     const { to, subject, text, html } = req.body;

//     if (!to || !subject) {
//         return res.status(400).json({
//             status: 'error',
//             message: 'Missing required fields: to, subject',
//         });
//     }

//     try {
//         // ✅ Fetch user's saved SMTP config
//         const user = await User.findById(userId);
//         if (!user || !user.smtpConnected || !user.smtpHost || !user.smtpPort || !user.smtpUser || !user.smtpPass) {
//             return res.status(400).json({
//                 status: 'error',
//                 message: 'SMTP not connected or incomplete SMTP settings for this user',
//             });
//         }

//         // ✅ Create transporter using user's saved SMTP config
//         const transporter = nodemailer.createTransport({
//             host: user.smtpHost,
//             port: user.smtpPort,
//             secure: user.smtpSecure,
//             auth: {
//                 user: user.smtpUser,
//                 pass: user.smtpPass,
//             },
//         });

//         // ✅ Prepare mail options
//         const mailOptions = {
//             from: `"Contacts Management" <${user.smtpUser}>`,
//             to,
//             subject,
//             text: text || '',
//             html: html || '',
//         };

//         // ✅ Send email
//         const info = await transporter.sendMail(mailOptions);

//         res.json({
//             status: 'success',
//             message: 'Email sent via user SMTP successfully',
//         });

//     } catch (error) {
//         console.error('SMTP Send Email Error:', error);
//         res.status(500).json({
//             status: 'error',
//             message: 'Failed to send email via SMTP',
//             error: error.message,
//         });
//     }
// };

const { google } = require('googleapis');
const axios = require('axios');
const nodemailer = require('nodemailer');
require('dotenv').config();
const User = require('../models/userModel'); // Your Mongoose User Model

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

exports.sendEmail = async (req, res) => {
    const { emailProvider, fromEmail, fromGoogleRefreshToken, fromMicrosoftAccessToken, to, subject, text, html } = req.body;
    const userId = req.user?._id;

    if (!emailProvider || !to || !subject) {
        return res.status(400).json({
            status: 'error',
            message: 'Missing required fields: emailProvider, to, subject',
        });
    }

    try {
        if (emailProvider === 'google') {
            if (!fromEmail || !fromGoogleRefreshToken) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Missing Google credentials: fromEmail, fromGoogleRefreshToken',
                });
            }

            const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
            oAuth2Client.setCredentials({ refresh_token: fromGoogleRefreshToken });

            const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

            let messageParts = [
                `From: ${fromEmail}`,
                `To: ${to}`,
                `Subject: ${subject}`,
                'Content-Type: text/html; charset=utf-8',
                '',
                html || text || '',
            ];

            const message = messageParts.join('\n');
            const encodedMessage = Buffer.from(message)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            await gmail.users.messages.send({
                userId: 'me',
                requestBody: { raw: encodedMessage },
            });

            return res.json({
                status: 'success',
                message: 'Email sent via Google Gmail API',
            });
        }

        else if (emailProvider === 'microsoft') {
            if (!fromEmail || !fromMicrosoftAccessToken) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Missing Microsoft credentials: fromEmail, fromMicrosoftAccessToken',
                });
            }

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

            await axios.post(
                'https://graph.microsoft.com/v1.0/me/sendMail',
                emailContent,
                {
                    headers: {
                        Authorization: `Bearer ${fromMicrosoftAccessToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            return res.json({
                status: 'success',
                message: 'Email sent via Microsoft Graph API',
            });
        }

        else if (emailProvider === 'smtp') {
            if (!userId) {
                return res.status(401).json({
                    status: 'error',
                    message: 'User authentication required for SMTP',
                });
            }

            const user = await User.findById(userId);
            if (!user || !user.smtpConnected || !user.smtpHost || !user.smtpPort || !user.smtpUser || !user.smtpPass) {
                return res.status(400).json({
                    status: 'error',
                    message: 'SMTP not connected or incomplete SMTP settings for this user',
                });
            }

            const transporter = nodemailer.createTransport({
                host: user.smtpHost,
                port: user.smtpPort,
                secure: user.smtpSecure,
                auth: {
                    user: user.smtpUser,
                    pass: user.smtpPass,
                },
            });

            const mailOptions = {
                from: `"Contacts Management" <${user.smtpUser}>`,
                to,
                subject,
                text: text || '',
                html: html || '',
            };

            await transporter.sendMail(mailOptions);

            return res.json({
                status: 'success',
                message: 'Email sent via User SMTP',
            });
        }

        else {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid type. Allowed types: google, microsoft, smtp',
            });
        }

    } catch (error) {
        console.error('Send Email Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to send email',
            error: error.response?.data || error.message,
        });
    }
};
