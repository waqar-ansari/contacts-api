const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const User = require('../models/userModel'); // Your User Model
const querystring = require('querystring');

// Google OAuth Setup
//for live
// const CLIENT_ID = '401067515093-9j7faengj216m6uc9csubrmo3men1m7p.apps.googleusercontent.com';
// const CLIENT_SECRET = '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';
// const REDIRECT_URI = 'https://100rjobf76.execute-api.eu-north-1.amazonaws.com/connect/google-callback';
// const MICROSOFT_CLIENT_ID = 'YOUR_MICROSOFT_CLIENT_ID';
// const MICROSOFT_CLIENT_SECRET = 'YOUR_MICROSOFT_CLIENT_SECRET';
// const MICROSOFT_REDIRECT_URI = 'https://yourdomain.com/connect/microsoft-callback';

//for local
const CLIENT_ID = '690630511368-pfehj1kgnim33509j2d04ok6quinj6vd.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3003/connect/google-callback';
const MICROSOFT_CLIENT_ID = 'c74e3dd9-5e49-417e-b256-75739bbc1716';
const MICROSOFT_CLIENT_SECRET = '0ef8618f-ef3e-4fdf-b992-3ae4453ea5db';
const MICROSOFT_REDIRECT_URI = 'http://localhost:3003/connect/microsoft-callback';


const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// 1. API to Generate Google OAuth URL
exports.connectGoogle = async (req, res) => {
    const userId  = req.user._id;

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
        // return res.redirect('https://yourfrontenddomain.com/dashboard');
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Google callback failed', error });
    }
};

exports.connectMicrosoft = async (req, res) => {
    const  userId  = req.user._id;

    const params = querystring.stringify({
        client_id: MICROSOFT_CLIENT_ID,
        response_type: 'code',
        redirect_uri: MICROSOFT_REDIRECT_URI,
        response_mode: 'query',
        scope: 'User.Read offline_access',
        state: userId,
    });

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;

    res.json({ status: 'success', url: authUrl });
};

exports.microsoftCallback = async (req, res) => {
    const { code, state } = req.query;
    const userId = state;

    try {
        const tokenResponse = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', new URLSearchParams({
            client_id: MICROSOFT_CLIENT_ID,
            client_secret: MICROSOFT_CLIENT_SECRET,
            code,
            redirect_uri: MICROSOFT_REDIRECT_URI,
            grant_type: 'authorization_code',
        }).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;

        const userProfile = await axios.get('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        user.microsoftId = userProfile.data.id;
        user.microsoftEmail = userProfile.data.mail || userProfile.data.userPrincipalName;
        user.microsoftAccessToken = accessToken;
        user.microsoftConnected = true;
        await user.save();

        res.json({ status: 'success', message: 'Microsoft account connected', user });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Microsoft OAuth failed', error: error.message });
    }
};


