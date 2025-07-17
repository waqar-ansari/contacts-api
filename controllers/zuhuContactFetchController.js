const querystring = require("querystring");
const axios = require("axios");
const Contact = require("../models/contactModel"); // adjust as needed
const mongoose = require("mongoose");
require("dotenv").config();

const redirectToZoho = (req, res) => {
    const scopes = [
        'ZohoCRM.modules.contacts.READ'
    ];

    const params = querystring.stringify({
        scope: scopes.join(','),
        client_id: process.env.ZOHO_CLIENT_ID,
        response_type: 'code',
        access_type: 'offline',
        redirect_uri: process.env.ZOHO_REDIRECT_URI,
        state: req.user._id
    });

    const authUrl = `https://accounts.zoho.com/oauth/v2/auth?${params}`;
    return res.json({ status: 'success', url: authUrl });
};


const handleZohoCallback = async (req, res) => {
    const { code, state: userId } = req.query;

    if (!code) {
        return res.status(400).json({ status: 'error', message: 'Missing Zoho auth code' });
    }

    try {
        // Step 1: Get Access Token
        const tokenRes = await axios.post('https://accounts.zoho.com/oauth/v2/token', {}, {
            params: {
                grant_type: 'authorization_code',
                client_id: process.env.ZOHO_CLIENT_ID,
                client_secret: process.env.ZOHO_CLIENT_SECRET,
                redirect_uri: process.env.ZOHO_REDIRECT_URI,
                code,
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        });

        const accessToken = tokenRes.data.access_token;
        if (!accessToken) throw new Error('Access token not received from Zoho');
        const apiDomain = tokenRes.data.api_domain || 'https://www.zohoapis.com'; // fallback just in case

        // Step 2: Fetch Contacts from Zoho
        const contactRes = await axios.get(`${apiDomain}/crm/v2/Contacts`, {
            headers: {
                Authorization: `Zoho-oauthtoken ${accessToken}`
            }
        });

        const contacts = contactRes.data.data || [];

        // Step 3: Fetch existing contacts (to avoid duplicates)
        const existingContacts = await Contact.find({ createdBy: userId }, 'emailaddresses phonenumbers');
        const existingEmails = new Set();
        const existingPhones = new Set();

        for (const contact of existingContacts) {
            for (const email of contact.emailaddresses || []) {
                existingEmails.add(email.toLowerCase());
            }
            for (const phone of contact.phonenumbers || []) {
                existingPhones.add(phone);
            }
        }

        // Step 4: Format and filter contacts
        const contactsToInsert = [];

        for (const contact of contacts) {
            const firstName = contact.First_Name || '';
            const lastName = contact.Last_Name || '';
            const email = contact.Email?.toLowerCase();
            const phone = contact.Phone;

            // Skip if duplicate
            const isDuplicate =
                (email && existingEmails.has(email)) ||
                (phone && existingPhones.has(phone));

            if (isDuplicate) continue;

            const _id = new mongoose.Types.ObjectId();

            contactsToInsert.push({
                _id,
                contact_id: _id,
                firstname: firstName,
                lastname: lastName,
                emailaddresses: email ? [email] : [],
                phonenumbers: phone ? [phone] : [],
                company: '',
                designation: '',
                linkedin: '',
                instagram: '',
                telegram: '',
                twitter: '',
                facebook: '',
                createdBy: userId,
                activities: [
                    {
                        action: 'contact_created',
                        type: 'contact',
                        description: 'Contact imported from Zoho'
                    }
                ]
            });
        }

        // Step 5: Save new contacts
        let savedContacts = [];
        if (contactsToInsert.length > 0) {
            savedContacts = await Contact.insertMany(contactsToInsert);
        }

        // Step 6: Send response back to frontend
        const resultData = {
            status: 'success',
            message: 'Zoho Contacts imported successfully',
            contacts: savedContacts
        };

        return res.send(`
      <!DOCTYPE html>
    <html>
    <head>
        <title>Zoho Connected</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding-top: 50px; 
            }
            .success { color: green; font-size: 18px; margin-bottom: 20px; }
        </style>
    </head>
    <body>
        <div class="success">Zoho Contact fetch Successfully! You can close this window.</div>
        <script>
            window.opener.postMessage(${JSON.stringify(resultData)}, '*');
            window.close();
        </script>
    </body>
    </html>
`);


        //     return res.send(`
        //         <!DOCTYPE html>
        //   <html>
        //   <head><title>Zoho Connected</title></head>
        //   <body style="font-family: Arial; text-align:center; padding: 50px;">
        //     <div style="color:green;">Zoho Contact fetch successful! You can close this window.</div>
        //     <script>
        //       window.opener.postMessage(${JSON.stringify(resultData)}, '*');
        //       window.close();
        //     </script>
        //   </body>
        //   </html>
        //     `);

    } catch (error) {
        console.error('Zoho Import Error:', error.message);
        return res.send(`
            <script>
                window.opener.postMessage({ status: 'error', message: 'Zoho contact fetch failed', error: '${error.message}' }, '*');
                window.close();
            </script>
        `);
    }
};


module.exports = {
    redirectToZoho,
    handleZohoCallback
};
