const querystring = require("querystring");
const axios = require("axios");
const Contact = require("../models/contactModel"); // adjust as needed
const mongoose = require("mongoose");
require("dotenv").config();

const redirectToZoho = (req, res) => {

    const domain = req.body.domain || 'com'; // or get from user profile/settings
    const scopes = [
        'ZohoCRM.modules.contacts.READ'
    ];
    const userId = req.user._id;
    // Step 1: Redirect to Zoho OAuth   
    const params = querystring.stringify({
        scope: scopes.join(','),
        client_id: process.env.ZOHO_CLIENT_ID,
        response_type: 'code',
        access_type: 'offline',
        redirect_uri: process.env.ZOHO_REDIRECT_URI,
        state: `${userId}::${domain}` // Include region in state
    });

    const authUrl = `https://accounts.zoho.${domain}/oauth/v2/auth?${params}`;
    return res.json({ status: 'success', url: authUrl });
};


const handleZohoCallback = async (req, res) => {
    const { code, state } = req.query;

    if (!code) {
        return res.status(400).json({ status: 'error', message: 'Missing Zoho auth code' });
    }

    const [userId, domain] = state.split('::'); // 👈 extract region
    let zohoAPIURL = '';
    let zohoAccountsURL = '';


    try {
        // Step 1: Get Access Token
        // const tokenRes = await axios.post(`${zohoAccountsURL}/oauth/v2/token`, {}, {
        //     params: {
        //         grant_type: 'authorization_code',
        //         client_id: process.env.ZOHO_CLIENT_ID,
        //         client_secret: process.env.ZOHO_CLIENT_SECRET,
        //         redirect_uri: process.env.ZOHO_REDIRECT_URI,
        //         code,
        //     },
        //     headers: {
        //         'Content-Type': 'application/x-www-form-urlencoded',
        //     }
        // });
        // const querystring = require("querystring");

        // const tokenRes = await axios.post(`${zohoAccountsURL}/oauth/v2/token`,
        //     querystring.stringify({
        //         grant_type: 'authorization_code',
        //         client_id: process.env.ZOHO_CLIENT_ID,
        //         client_secret: process.env.ZOHO_CLIENT_SECRET,
        //         redirect_uri: process.env.ZOHO_REDIRECT_URI,
        //         code
        //     }),
        //     {
        //         headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        //     }
        // );

        // console.log('CODE:', code);
        // console.log('Zoho token response:', tokenRes.data);

        // const tokenData = tokenRes.data;
        // const userInfoRes = await axios.get(`${zohoAccountsURL}/oauth/user/info`, {
        //     headers: {
        //         Authorization: `Zoho-oauthtoken ${tokenData.access_token}`
        //     }
        // });

        // const realDomain = userInfoRes.data?.Accounts_domain || `zoho.${domain}`;
        // // Optionally, update user model with this real domain
        // console.log("Detected Zoho Domain:", realDomain);

        // if (!tokenData.access_token) {
        //     console.error('Zoho token response:', tokenData);
        //     return res.status(400).json({ status: 'error', message: 'Access token not received from Zoho' });
        // }

        // Step 1: Try getting Access Token from all known domains
        const domainsToTry = ['in', 'com', 'eu', 'com.au']; // Extend this list as needed
        let tokenData = null;
        let successfulDomain = null;

        for (const d of domainsToTry) {
            try {
                const tokenRes = await axios.post(
                    `https://accounts.zoho.${d}/oauth/v2/token`,
                    querystring.stringify({
                        grant_type: 'authorization_code',
                        client_id: process.env.ZOHO_CLIENT_ID,
                        client_secret: process.env.ZOHO_CLIENT_SECRET,
                        redirect_uri: process.env.ZOHO_REDIRECT_URI,
                        code
                    }),
                    {
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                    }
                );

                if (tokenRes.data.access_token) {
                    tokenData = tokenRes.data;
                    successfulDomain = d;
                    console.log(`✅ Successful domain: .${successfulDomain}`);
                    zohoAccountsURL = `https://accounts.zoho.${successfulDomain}`;
                    zohoAPIURL = `https://www.zohoapis.${successfulDomain}`;
                    break;
                }
            } catch (err) {
                console.log(`Failed token fetch for .${d} domain:`, err.response?.data || err.message);
            }
        }

        if (!tokenData || !tokenData.access_token) {
            return res.status(400).json({
                status: 'error',
                message: 'Access token not received from Zoho',
                details: tokenData
            });
        }


        // Step 2: Use token to fetch Zoho contacts
        const contactRes = await axios.get(`${zohoAPIURL}/crm/v2/Contacts`, {
            headers: {
                Authorization: `Zoho-oauthtoken ${tokenData.access_token}`,
            },
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
        console.log('Result Data:', resultData);

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
    (function () {
      const resultData = ${JSON.stringify(resultData)};
      const tryPostMessage = () => {
        try {
          // Use wildcard origin to support cross-origin popup response
          window.opener.postMessage(resultData, '*');

          // Notify success for debug (optional)
          console.log("Message posted to opener.");
        } catch (e) {
          console.error("Failed to postMessage:", e);
        }

        try {
          window.close();
        } catch (e) {
          console.warn("window.close failed. Showing close button.");
        }

        // Fallback UI for browsers blocking close()
        setTimeout(() => {
          document.body.innerHTML = "<h3>Authorization complete.</h3><p>You can close this window.</p>";
        }, 2000);
      };

      // Wait a bit in case opener not ready
      setTimeout(tryPostMessage, 500);
    })();
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
