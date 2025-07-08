const logActivityToContact = async (contactId, activityObj) => {
    const Contact = require("../models/contactModel");
    try {
        await Contact.findByIdAndUpdate(contactId, {
            $push: {
                activities: {
                    action: activityObj.action,
                    description: activityObj.description,
                    timestamp: new Date(),
                },
            },
        });
    } catch (err) {
        console.error("Error logging activity to contact:", err.message);
    }
};

module.exports = { logActivityToContact };
