const mongoose = require("mongoose");
const Contact = require("../models/contactModel");
const { logActivityToContact } = require("../utils/activityLogger");

const deleteMeeting = async (req, res) => {
    const { contact_id, meeting_id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(contact_id)) {
        return res.status(400).json({
            status: "error",
            message: "Invalid contact ID",
        });
    }

    try {
        // 1️⃣ Find the contact first (to get the meeting title)
        const contact = await Contact.findOne({
            _id: contact_id,
            createdBy: req.user._id,
            "meetings.meeting_id": meeting_id,
        });

        if (!contact) {
            return res.status(404).json({
                status: "error",
                message: "Meeting not found in this contact or unauthorized access",
            });
        }

        // 2️⃣ Get the meeting title
        const meeting = contact.meetings.find(m => m.meeting_id === meeting_id);
        const meetingTitle = meeting ? meeting.title : "Untitled Meeting";

        // 3️⃣ Delete the meeting
        await Contact.updateOne(
            { _id: contact_id },
            { $pull: { meetings: { meeting_id } } }
        );

        // 4️⃣ Log meeting deletion activity with title instead of ID
        await logActivityToContact(contact_id, {
            action: "meeting_deleted",
            type: "meeting",
            title: "Meeting Deleted",
            description: `${meetingTitle}`,
        });

        return res.status(200).json({
            status: "success",
            message: "Meeting Deleted",
            data: { meeting_id },
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

