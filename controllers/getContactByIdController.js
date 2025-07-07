const Contact = require("../models/contactModel");

const getContactById = async (req, res) => {
    try {
        const contact_id = req.body.contact_id; // Get contactId from body or query params
        if (!contact_id) {
            return res.status(400).json({ status: "error", message: "Contact ID is required" });
        }
        const contact = await Contact.findById(contact_id)
            .select("-_id -updatedAt -__v") // Exclude unnecessary fields
            .lean(); // Use lean for better performance
        if (!contact) {
            return res.status(404).json({ status: "error", message: "Contact not found" });
        }
        // Clean emailaddresses (array of strings)
        contact.emailaddresses = (Array.isArray(contact.emailaddresses)
            ? contact.emailaddresses.filter(email => email && email.trim() !== "")
            : []);
        // Clean phonenumbers (array of strings)
        contact.phonenumbers = (Array.isArray(contact.phonenumbers)
            ? contact.phonenumbers.filter(number => number && number.trim() !== "")
            : []);
        if (Array.isArray(contact.tags)) {
            contact.tags = contact.tags.map((tagObj) => ({
                tag: tagObj.tag,
                emoji: tagObj.emoji
            }));
        }
        return res.json({
            status: "success",
            message: "Contact fetched successfully",
            data : contact,
        });
    } catch (error) {
        console.error("Error fetching contact:", error);
        return res.status(500).json({ status: "error", message: "Failed to fetch contact", error });
    }
};
module.exports = { getContactById };