const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const User = require('../models/userModel'); // Your User Model
const querystring = require('querystring');

// Google OAuth Setup
//for live
const CLIENT_ID = '401067515093-9j7faengj216m6uc9csubrmo3men1m7p.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'https://100rjobf76.execute-api.eu-north-1.amazonaws.com/connect/google-callback';

//for local
// const CLIENT_ID = '690630511368-pfehj1kgnim33509j2d04ok6quinj6vd.apps.googleusercontent.com';
// const CLIENT_SECRET = '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';
// const REDIRECT_URI = 'http://localhost:3003/connect/google-callback';


const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// 1. API to Generate Google OAuth URL
// exports.connectGoogle = async (req, res) => {
//     const { email } = req.body;

//     try {
//         const user = await User.findOne({ email });

//         if (!user) {
//             return res.status(404).json({ status: 'error', message: 'User not found' });
//         }

//         const scopes = [
//             'https://www.googleapis.com/auth/userinfo.email',
//             'https://www.googleapis.com/auth/userinfo.profile',
//         ];

//         const params = querystring.stringify({
//             client_id: CLIENT_ID,
//             redirect_uri: REDIRECT_URI,
//             response_type: 'code',
//             scope: scopes.join(' '),
//             access_type: 'offline',
//             prompt: 'consent',
//             state: email,
//         });

//         const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

//         res.json({ status: 'success', url: authUrl });
//     } catch (error) {
//         res.status(500).json({ status: 'error', message: 'Failed to generate Google OAuth URL', error });
//     }
// };

exports.connectGoogle = async (req, res) => {
    const { userId } = req.body;

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        const scopes = [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
        ];

        const params = querystring.stringify({
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            response_type: 'code',
            scope: scopes.join(' '),
            access_type: 'offline',
            prompt: 'consent',
            state: userId,   // ✅ Pass User ID here, not email
        });

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

        res.json({ status: 'success', url: authUrl });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to generate Google OAuth URL', error });
    }
};


// 2. Google OAuth Callback API

// exports.googleCallback = async (req, res) => {
//     const { code, state } = req.query;
//     const email = state; // Email passed in step 1

//     try {
//         const { tokens } = await oauth2Client.getToken(code);
//         oauth2Client.setCredentials(tokens);

//         const googleUser = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
//             headers: { Authorization: `Bearer ${tokens.access_token}` },
//         });

//         const user = await User.findOne({ email });

//         if (!user) {
//             return res.status(404).json({ status: 'error', message: 'User not found' });
//         }

//         // Save Google info and connection status
//         user.googleId = googleUser.data.id;
//         user.googleEmail = googleUser.data.email;
//         user.googleAccessToken = tokens.access_token;
//         user.googleRefreshToken = tokens.refresh_token;
//         user.googleConnected = true;   // ✅ This marks the user as connected with Google
//         await user.save();

//         res.json({ status: 'success', message: 'Google connected successfully', user });
//     } catch (error) {
//         res.status(500).json({ status: 'error', message: 'Google callback failed', error });
//     }
// };

exports.googleCallback = async (req, res) => {
    const { code, state } = req.query;
    const userId = state;  // ✅ Now state contains userId

    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const googleUser = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        // Save Google info for this user - no email check needed
        user.googleId = googleUser.data.id;
        user.googleEmail = googleUser.data.email;    // ✅ This can be any Google email
        user.googleAccessToken = tokens.access_token;
        user.googleRefreshToken = tokens.refresh_token;
        user.googleConnected = true;
        await user.save();

        res.json({ status: 'success', message: 'Google connected successfully', user });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Google callback failed', error });
    }
};


