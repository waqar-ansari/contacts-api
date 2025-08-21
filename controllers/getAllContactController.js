const Contact = require("../models/contactModel");

const getAllContact = async (req, res) => {
    try {
        const userId = req.user._id;

        // Fetch contacts of the logged-in user
        const contacts = await Contact.find({ createdBy: userId })
            .select("firstname lastname emailaddresses phonenumbers")
            .lean();

        // Format contacts
        const formattedContacts = contacts.map(contact => ({
            contact_id: contact._id,
            firstname: contact.firstname || "",
            lastname: contact.lastname || "",
            emailaddresses: Array.isArray(contact.emailaddresses)
                ? contact.emailaddresses.filter(email => email && email.trim() !== "")
                : [],
            // phonenumbers: Array.isArray(contact.phonenumbers)
            //     ? contact.phonenumbers.filter(phone => phone && phone.trim() !== "")
            //     : []
            phonenumbers: Array.isArray(contact.phonenumbers)
                ? contact.phonenumbers.filter(p => {
                    const hasNumber =
                        p?.number && typeof p.number === "string" && p.number.trim() !== "";
                    const hasCountry =
                        p?.countryCode && typeof p.countryCode === "string" && p.countryCode.trim() !== "";
                    return hasNumber || hasCountry;
                })
                : []
        }));

        return res.json({
            status: "success",
            message: "Contacts fetched successfully",
            data: formattedContacts
        });
    } catch (error) {
        console.error("Error fetching contacts:", error);
        return res.status(500).json({
            status: "error",
            message: "Failed to fetch contacts",
            error
        });
    }
};


module.exports = { getAllContact };