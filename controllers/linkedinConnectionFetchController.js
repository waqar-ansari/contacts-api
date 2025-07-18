const axios = require("axios");
const Contact = require("../models/contactModel");
const User = require("../models/userModel");
const mongoose = require("mongoose");

const client_id = process.env.LINKEDIN_CLIENT_ID;
const client_secret = process.env.LINKEDIN_CLIENT_SECRET;
const redirect_uri = process.env.LINKEDIN_FETCH_CONTACTS_REDIRECT_URI;


// Step 1: Redirect to LinkedIn
const redirectToLinkedIn = (req, res) => {
    const scope = 'r_liteprofile r_emailaddress r_network';
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scope)}`;
    res.redirect(authUrl);
};


const handleLinkedinCallback = async (req, res) => {
    const code = req.query.code;
    try {
        const tokenRes = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
            params: {
                grant_type: 'authorization_code',
                code,
                redirect_uri,
                client_id,
                client_secret,
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const accessToken = tokenRes.data.access_token;

        // ✅ Get user profile
        const profileRes = await axios.get('https://api.linkedin.com/v2/me', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        // ✅ Get user email
        const emailRes = await axios.get('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const profileData = profileRes.data;
        const email = emailRes.data.elements[0]['handle~'].emailAddress;

        const userInfo = {
            id: profileData.id,
            firstName: profileData.localizedFirstName,
            lastName: profileData.localizedLastName,
            email: email,
        };

        res.json({ userInfo, accessToken });
    } catch (err) {
        res.status(500).json({ error: 'LinkedIn fetch failed', details: err.message });
    }
};

module.exports = { redirectToLinkedIn, handleLinkedinCallback };
