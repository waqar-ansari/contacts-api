// controllers/icloudController.js

const dav = require("dav");
const Contact = require("../models/contactModel"); // your mongoose contact schema
const mongoose = require("mongoose");

const fetchiCloudContacts = async (req, res) => {
  const { icloudEmail, appPassword } = req.body;

    const userId = req.user._id; // Assuming user ID is available in the request context

    if(!userId){
    return res.status(400).json({ status: "error", message: "User ID is required" });
    }

  if (!icloudEmail || !appPassword || !userId) {
    return res.status(400).json({ status: "error", message: "Missing credentials or userId" });
  }

  try {
    const xhr = new dav.transport.Basic({
      username: icloudEmail,
      password: appPassword,
    });

    const serverUrl = 'https://contacts.icloud.com';

    const account = await dav.createAccount({
      server: serverUrl,
      xhr,
      loadCollections: true,
      loadObjects: true,
    });

    const contacts = [];
    for (const addressBook of account.addressBooks) {
      for (const card of addressBook.objects) {
        contacts.push(card);
      }
    }

    const contactsToInsert = [];

    for (const contact of contacts) {
      const data = contact.data;

      const match = data.match(/FN:(.*)/);
      const name = match ? match[1] : "";

      const emailMatch = data.match(/EMAIL.*?:(.*)/);
      const email = emailMatch ? emailMatch[1].toLowerCase() : "";

      const phoneMatch = data.match(/TEL.*?:(.*)/);
      const phone = phoneMatch ? phoneMatch[1].replace(/\+/g, "") : "";

      const [firstname = "", ...lastnameParts] = name.split(" ");
      const lastname = lastnameParts.join(" ");

      // Skip if empty
      if (!email && !phone) continue;

      const existing = await Contact.findOne({
        createdBy: userId,
        $or: [
          { emailaddresses: email },
          { phonenumbers: phone }
        ]
      });

      if (existing) continue;

      const _id = new mongoose.Types.ObjectId();

      contactsToInsert.push({
        _id,
        contact_id: _id,
        firstname,
        lastname,
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
            description: 'Contact imported from iCloud',
          }
        ],
      });
    }

    const savedContacts = await Contact.insertMany(contactsToInsert);

    return res.json({
      status: 'success',
      message: 'iCloud Contacts imported successfully',
      contacts: savedContacts,
    });

  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch iCloud contacts',
      error: err.message,
    });
  }
};

module.exports = {
  fetchiCloudContacts,
};
