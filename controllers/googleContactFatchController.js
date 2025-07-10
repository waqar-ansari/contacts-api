const { google } = require('googleapis');
const querystring = require('querystring');
const Contact = require('../models/contactModel'); // ✅ Adjust path as needed
const mongoose = require("mongoose"); // ⬅️ Make sure this is imported at the top


const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI3 // e.g., http://localhost:3000/api/google/callback
);

// Step 1: Generate the Google OAuth Consent URL
const redirectToGoogle = (req, res) => {
  const scopes = ['https://www.googleapis.com/auth/contacts.readonly'];

  const user_id = req.user._id; // Use user ID from request context if available

  const params = querystring.stringify({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI3,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: user_id,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  return res.json({ status: 'success', url: authUrl });
};

// Step 2: Google redirects here with ?code=... and ?state=...
// const handleGoogleCallback = async (req, res) => {
//   const { code } = req.query;

//   if (!code) {
//     return res.status(400).json({ status: 'error', message: 'Missing authorization code' });
//   }

//   try {
//     const { tokens } = await oauth2Client.getToken(code);
//     oauth2Client.setCredentials(tokens);

//     const peopleService = google.people({ version: 'v1', auth: oauth2Client });

//     const response = await peopleService.people.connections.list({
//       resourceName: 'people/me',
//       pageSize: 1000,
//       personFields: 'names,emailAddresses,phoneNumbers',
//     });

//     const userId = req.query.state || null;
//     if (!userId) {
//       return res.status(400).json({ status: 'error', message: 'Missing user ID in state parameter' });
//     }

//     // const connections = response.data.connections || [];

//     // const contacts = connections.map((person) => {
//     //   const name = person.names?.[0]?.displayName || '';
//     //   const [firstname = '', ...lastnameParts] = name.split(' ');
//     //   const lastname = lastnameParts.join(' ');

//     //   return {
//     //     firstname,
//     //     lastname,
//     //     emailaddresses: person.emailAddresses?.map((e) => e.value) || [],
//     //     phonenumbers: person.phoneNumbers?.map((p) => p.value) || [],
//     //     company: '',
//     //     designation: '',
//     //     linkedin: '',
//     //     instagram: '',
//     //     telegram: '',
//     //     twitter: '',
//     //     facebook: '',
//     //   };
//     // });

//     // return res.json({ status: 'success', contacts });

//     const connections = response.data.connections || [];

//     const contactsToInsert = connections.map((person) => {
//       const _id = new mongoose.Types.ObjectId(); // ✅ use same for _id and contact_id
//       const name = person.names?.[0]?.displayName || '';
//       const [firstname = '', ...lastnameParts] = name.split(' ');
//       const lastname = lastnameParts.join(' ');


//       return {
//         _id, // ✅ _id is the primary ID
//         contact_id: _id, // ✅ match _id so your update API works
//         firstname,
//         lastname,
//         emailaddresses: person.emailAddresses?.map((e) => e.value) || [],
//         phonenumbers: person.phoneNumbers?.map((p) => p.value) || [],
//         company: '',
//         designation: '',
//         linkedin: '',
//         instagram: '',
//         telegram: '',
//         twitter: '',
//         facebook: '',
//         createdBy: userId, // ✅ Save with user context
//         activities: [
//           {
//             action: 'contact_created',
//             description: `Contact ${firstname} ${lastname} imported from Google`,
//           }
//         ],
//       };
//     });

//     const savedContacts = await Contact.insertMany(contactsToInsert);

//     return res.json({ status: 'success', contacts: savedContacts });


//   } catch (error) {
//     console.error('Google Contact Fetch Error:', error);
//     return res.status(500).json({
//       status: 'error',
//       message: 'Failed to fetch Google contacts',
//       error: error.message,
//     });
//   }
// };

const handleGoogleCallback = async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ status: 'error', message: 'Missing authorization code' });
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const peopleService = google.people({ version: 'v1', auth: oauth2Client });

    const response = await peopleService.people.connections.list({
      resourceName: 'people/me',
      pageSize: 1000,
      personFields: 'names,emailAddresses,phoneNumbers',
    });

    const userId = req.query.state || null;
    if (!userId) {
      return res.status(400).json({ status: 'error', message: 'Missing user ID in state parameter' });
    }

    const connections = response.data.connections || [];

    // Fetch existing contact emails and phones for this user
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

    const contactsToInsert = [];

    for (const person of connections) {
      const name = person.names?.[0]?.displayName || '';
      const [firstname = '', ...lastnameParts] = name.split(' ');
      const lastname = lastnameParts.join(' ');

      const emailList = person.emailAddresses?.map(e => e.value.toLowerCase()) || [];
      const phoneList = person.phoneNumbers?.map(p => p.value.replace(/\+/g, '')) || []; // ⬅️ Cleaned

      // Skip if any email or phone matches existing
      const isDuplicate =
        emailList.some(email => existingEmails.has(email)) ||
        phoneList.some(phone => existingPhones.has(phone));

      if (isDuplicate) continue;

      const _id = new mongoose.Types.ObjectId();

      contactsToInsert.push({
        _id,
        contact_id: _id,
        firstname,
        lastname,
        emailaddresses: emailList,
        phonenumbers: phoneList,
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
            description: `Contact ${firstname} ${lastname} imported from Google`,
          }
        ],
      });
    }

    let savedContacts = [];
    if (contactsToInsert.length > 0) {
      savedContacts = await Contact.insertMany(contactsToInsert);
    }

    return res.json({
      status: 'success',
      contacts: savedContacts, // ✅ only imported contacts
    });

  } catch (error) {
    console.error('Google Contact Fetch Error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch Google contacts',
      error: error.message,
    });
  }
};


module.exports = {
  redirectToGoogle,
  handleGoogleCallback,
};
