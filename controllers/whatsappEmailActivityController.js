const mongoose = require("mongoose");
const Contact = require("../models/contactModel"); // adjust path if needed
const { logActivityToContact } = require("../utils/activityLogger");

const logMessageActivity = async (req, res) => {
    try {
        const { contact_id, whatsappMessage, emailMessage } = req.body;

        if (!contact_id || !mongoose.Types.ObjectId.isValid(contact_id)) {
            return res.status(400).json({ status: "error", message: "Invalid contact_id" });
        }

        const contact = await Contact.findOne({ _id: contact_id, createdBy: req.user._id });
        if (!contact) {
            return res.status(404).json({ status: "error", message: "Contact not found" });
        }

        if (!whatsappMessage && !emailMessage) {
            return res.status(400).json({ status: "error", message: "No message provided" });
        }

        // Log WhatsApp message activity
        if (whatsappMessage) {
            await logActivityToContact(contact_id, {
                action: "whatsapp_message_sent",
                type: "whatsapp",
                description: `WhatsApp message sent Successfully : ${whatsappMessage}`
            });
        }

        // Log Email message activity
        if (emailMessage) {
            await logActivityToContact(contact_id, {
                action: "email_message_sent",
                type: "email",
                description: `Email message sent Successfully: ${emailMessage}`
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Message activities logged successfully"
        });

    } catch (error) {
        console.error("Error in logMessageActivity:", error);
        return res.status(500).json({ status: "error", message: "Internal server error" });
    }
};

module.exports = { logMessageActivity };
