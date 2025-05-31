// const Contact = require("../models/contactModel");

// const getContactEvents = async (req, res) => {
//     try {
//         const { contact_id } = req.body;
//         const userId = req.user._id;

//         const contact = await Contact.findOne({
//             _id: contact_id,
//             createdBy: userId,
//         });

//         if (!contact) {
//             return res.status(404).json({
//                 status: "error",
//                 message: "Contact not found or unauthorized access",
//             });
//         }

//         const events = [];

//         // Tasks
//         if (Array.isArray(contact.tasks)) {
//             contact.tasks.forEach((task) => {
//                 if (task.taskDueDate) {
//                     events.push({
//                         type: "task",
//                         event_id: task.task_id,
//                         title: task.taskTitle || "Task",
//                         start: task.taskDueDate,
//                         end: task.taskDueDate,
//                         startTime: task.taskDueTime || null,
//                         endTime: task.taskDueTime || null,
//                         color: "#4CAF50", // green for tasks
//                         createdAt: task.createdAt,
//                         updatedAt: task.updatedAt,
//                     });
//                 }
//             });
//         }

//         // Meetings
//         if (Array.isArray(contact.meetings)) {
//             contact.meetings.forEach((meeting) => {
//                 if (meeting.meetingStartDate && meeting.meetingEndDate) {
//                     events.push({
//                         type: "meeting",
//                         event_id: meeting.meeting_id,
//                         title: meeting.meetingTitle || "Meeting",
//                         start: meeting.meetingStartDate,
//                         end: meeting.meetingEndDate,
//                         startTime: meeting.meetingStartTime || null,
//                         endTime: meeting.meetingEndTime || null,
//                         color: "#2196F3", // blue for meetings
//                         location: meeting.meetingLocation || null,
//                         link: meeting.meetingLink || null,
//                         meetingType: meeting.meetingType,
//                         createdAt: meeting.createdAt,
//                         updatedAt: meeting.updatedAt,
//                     });
//                 }
//             });
//         }

//         return res.status(200).json({
//             status: "success",
//             message: "Contact events fetched successfully",
//             data: events,
//         });
//     } catch (error) {
//         console.error("Error fetching contact events:", error);
//         return res.status(500).json({
//             status: "error",
//             message: "An error occurred while fetching contact events",
//         });
//     }
// };

// module.exports = { getContactEvents };

const Contact = require("../models/contactModel");

const getProfileEvents = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get all contacts for the logged-in user
        const contacts = await Contact.find({ createdBy: userId });

        const events = [];

        contacts.forEach((contact) => {
            const contactName = contact.name || "Unnamed Contact";

            // Tasks
            if (Array.isArray(contact.tasks)) {
                contact.tasks.forEach((task) => {
                    if (task.taskDueDate) {
                        events.push({
                            type: "task",
                            event_id: task.task_id,
                            // contact_id: contact._id,
                            // contact_name: contactName,
                            title: task.taskTitle,
                            start: task.taskDueDate,
                            end: task.taskDueDate,
                            startTime: task.taskDueTime || null,
                            endTime: task.taskDueTime || null,
                            color: "#4CAF50", // green
                            createdAt: task.createdAt,
                            updatedAt: task.updatedAt,
                        });
                    }
                });
            }

            // Meetings
            if (Array.isArray(contact.meetings)) {
                contact.meetings.forEach((meeting) => {
                    if (meeting.meetingStartDate && meeting.meetingEndDate) {
                        events.push({
                            type: "meeting",
                            event_id: meeting.meeting_id,
                            // contact_id: contact._id,
                            // contact_name: contactName,
                            title: meeting.meetingTitle,
                            start: meeting.meetingStartDate,
                            end: meeting.meetingEndDate,
                            startTime: meeting.meetingStartTime || null,
                            endTime: meeting.meetingEndTime || null,
                            color: "#2196F3", // blue
                            location: meeting.meetingLocation || null,
                            link: meeting.meetingLink || null,
                            meetingType: meeting.meetingType,
                            createdAt: meeting.createdAt,
                            updatedAt: meeting.updatedAt,
                        });
                    }
                });
            }
        });

        return res.status(200).json({
            status: "success",
            message: "Profile events fetched successfully",
            data: events,
        });
    } catch (error) {
        console.error("Error fetching contact events:", error);
        return res.status(500).json({
            status: "error",
            message: "An error occurred while fetching contact events",
        });
    }
};

module.exports = {
    getProfileEvents,
};

