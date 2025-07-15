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

    try {
        const tokenRes = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
            params: {
                grant_type: 'authorization_code',
                client_id: process.env.ZOHO_CLIENT_ID,
                client_secret: process.env.ZOHO_CLIENT_SECRET,
                redirect_uri: process.env.ZOHO_REDIRECT_URI,
                code,
            },
        });

        const accessToken = tokenRes.data.access_token;

        console.log(`Zoho access token: ${accessToken}`);
        

        // Step 4: Fetch contacts from Zoho CRM
        const contactRes = await axios.get('https://www.zohoapis.com/crm/v2/Contacts', {
            headers: {
                Authorization: `Zoho-oauthtoken ${accessToken}`
            }
        });

        const contacts = contactRes.data.data || [];
        console.log(contacts);

        // Filter, format and save contacts to your DB
        const formatted = contacts.map(contact => ({
            firstname: contact.First_Name || '',
            lastname: contact.Last_Name || '',
            emailaddresses: contact.Email ? [contact.Email.toLowerCase()] : [],
            phonenumbers: contact.Phone ? [contact.Phone] : [],
            createdBy: userId,
            contact_id: new mongoose.Types.ObjectId(),
            activities: [{
                action: 'contact_created',
                type: 'contact',
                description: `Contact imported from Zoho`,
            }]
        }));

        await Contact.insertMany(formatted);

        return res.send(`
      <html><body>
        <p style="color:green;">Zoho Contacts imported successfully. You can close this window.</p>
        <script>
          window.opener.postMessage(${JSON.stringify({ status: 'success', contacts: formatted })}, '*');
          window.close();
        </script>
      </body></html>
    `);
    } catch (error) {
        return res.send(`<script>
        window.opener.postMessage({ status: 'error', message: 'Zoho import failed', error: '${error.message}' }, '*');
        window.close();
      </script>`);
    }
};

module.exports = {
    redirectToZoho,
    handleZohoCallback
};
