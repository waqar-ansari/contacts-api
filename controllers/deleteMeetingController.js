const mongoose = require("mongoose");
const Contact = require("../models/contactModel");

const deleteMeeting = async (req, res) => {
    const { contact_id, meeting_id } = req.body;

    // Validate only contactId
    if (!mongoose.Types.ObjectId.isValid(contact_id)) {
        return res.status(400).json({
            status: "error",
            message: "Invalid contact ID",
        });
    }


    try {
        const updatedContact = await Contact.findOneAndUpdate(
            {
                _id: contact_id,
                createdBy: req.user._id,
                "meetings.meeting_id": meeting_id,
            },
            {
                $pull: { meetings: { meeting_id: meeting_id } },
            },
            { new: true }
        );

        if (!updatedContact) {
            return res.status(404).json({
                status: "error",
                message: "Meeting not found in this contact or unauthorized access",
            });
        }
        console.log(updatedContact);


        return res.status(200).json({
            status: "success",
            message: "Meeting deleted successfully",
            data: { meeting_id: meeting_id },
        });
    } catch (error) {
        console.error("Delete Meeting Error:", error);
        return res.status(500).json({
            status: "error",
            message: "An error occurred while deleting the meeting",
        });
    }
};

module.exports = {
    deleteMeeting,
};
