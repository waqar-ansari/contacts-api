// const { google } = require('googleapis');
// const User = require('../models/userModel'); // adjust as needed

// const fetchGoogleContacts = async (req, res) => {
//     const userId = req.user._id;

//     try {
//         const user = await User.findById(userId);
//         if (!user || !user.googleAccessToken) {
//             return res.status(404).json({ status: 'error', message: 'Google account not connected' });
//         }

//         // Set up OAuth2 client
//         const oauth2Client = new google.auth.OAuth2(
//             process.env.GOOGLE_CLIENT_ID,
//             process.env.GOOGLE_CLIENT_SECRET,
//             process.env.GOOGLE_REDIRECT_URI
//         );

//         oauth2Client.setCredentials({
//             access_token: user.googleAccessToken,
//             refresh_token: user.googleRefreshToken,
//         });

//         const peopleService = google.people({ version: 'v1', auth: oauth2Client });

//         const response = await peopleService.people.connections.list({
//             resourceName: 'people/me',
//             pageSize: 1000,
//             personFields: 'names,emailAddresses,phoneNumbers',
//         });

//         const connections = response.data.connections || [];

//         const contacts = connections.map(person => ({
//             name: person.names?.[0]?.displayName || '',
//             email: person.emailAddresses?.[0]?.value || '',
//             phone: person.phoneNumbers?.[0]?.value || ''
//         }));

//         return res.json({ status: 'success', contacts });

//     } catch (error) {
//         console.error('Error fetching Google Contacts:', error);
//         return res.status(500).json({ status: 'error', message: 'Failed to fetch Google Contacts', error: error.message });
//     }
// };

// module.exports = { fetchGoogleContacts };
const { google } = require('googleapis');

const fetchGoogleContacts = async (req, res) => {
    const { accessToken } = req.body;

    if (!accessToken) {
        return res.status(400).json({ status: 'error', message: 'Google access token is required' });
    }

    try {
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });

        const peopleService = google.people({ version: 'v1', auth: oauth2Client });

        const response = await peopleService.people.connections.list({
            resourceName: 'people/me',
            pageSize: 1000,
            personFields: 'names,emailAddresses,phoneNumbers',
        });

        const connections = response.data.connections || [];

        const contacts = connections.map((person) => {
            const name = person.names?.[0]?.displayName || '';
            const [firstname = '', ...lastnameParts] = name.split(' ');
            const lastname = lastnameParts.join(' ');

            return {
                firstname,
                lastname,
                emailaddresses: person.emailAddresses?.map((e) => e.value) || [],
                phonenumbers: person.phoneNumbers?.map((p) => p.value) || [],
                company: '',
                designation: '',
                linkedin: '',
                instagram: '',
                telegram: '',
                twitter: '',
                facebook: '',
            };
        });

        return res.json({ status: 'success', contacts });

    } catch (error) {
        console.error('Error fetching Google Contacts:', error);
        return res.status(500).json({ status: 'error', message: 'Failed to fetch Google Contacts', error: error.message });
    }
};

module.exports = { fetchGoogleContacts };



