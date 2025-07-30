const Contact = require("../models/contactModel");

const getContactEmail = async (req, res) => {
    try {
        const { search = "" } = req.body;

        // Base query for current user
        const emailQuery = {
            createdBy: req.user._id,
        };

        // If search is provided, filter emailaddresses
        if (search.trim()) {
            emailQuery.emailaddresses = {
                $elemMatch: { $regex: search.trim(), $options: "i" }
            };
        }

        // Fetch only email addresses
        const rawContacts = await Contact.find(emailQuery).select("emailaddresses -_id");

        // Clean and flatten all email addresses
        const emails = rawContacts.flatMap(contact =>
        (Array.isArray(contact.emailaddresses)
            ? contact.emailaddresses.filter(email => email && email.trim() !== "")
            : [])
        );

        res.json({
            status: "success",
            message: "Contact emails fetched successfully",
            data: emails,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server error" });
    }
};

module.exports = { getContactEmail };
