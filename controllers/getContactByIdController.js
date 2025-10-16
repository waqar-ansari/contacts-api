const Contact = require("../models/contactModel");

const getContactById = async (req, res) => {
    try {
        const contact_id = req.body.contact_id; // Get contactId from body or query params
        const { apiType = "web" } = req.body;
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
        // contact.phonenumbers = (Array.isArray(contact.phonenumbers)
        //     ? contact.phonenumbers.filter(number => number && number.trim() !== "")
        //     : []);
        // contact.phonenumbers = Array.isArray(contact.phonenumbers)
        //     ? contact.phonenumbers.filter(p => {
        //         const hasNumber =
        //             p?.number && typeof p.number === "string" && p.number.trim() !== "";
        //         const hasCountry =
        //             p?.countryCode && typeof p.countryCode === "string" && p.countryCode.trim() !== "";
        //         return hasNumber || hasCountry;
        //     })
        //     : [];
        if (Array.isArray(contact.phonenumbers)) {
            const filteredPhones = contact.phonenumbers.filter(p => {
                const hasNumber =
                    p?.number && typeof p.number === "string" && p.number.trim() !== "";
                const hasCountry =
                    p?.countryCode && typeof p.countryCode === "string" && p.countryCode.trim() !== "";
                return hasNumber || hasCountry;
            });

            if (apiType === "web") {
                // Combine into string format for web
                contact.phonenumbers = filteredPhones.map(p => {
                    let cc = p.countryCode ? p.countryCode.trim() : "";
                    let num = p.number ? p.number.trim() : "";
                    return cc && num ? `${cc}${num}` : num || cc;
                });
            } else {
                // Keep object format for mobile
                contact.phonenumbers = filteredPhones;
            }
        } else {
            contact.phonenumbers = [];
        }

        if (Array.isArray(contact.tags)) {
            contact.tags = contact.tags.map((tagObj) => ({
                tag: tagObj.tag,
                emoji: tagObj.emoji
            }));
        }
        return res.json({
            status: "success",
            message: "Contact Fetched",
            data: contact,
        });
    } catch (error) {
        console.error("Error fetching contact:", error);
        return res.status(500).json({ status: "error", message: "Failed to fetch contact", error });
    }
};
module.exports = { getContactById };