const Contact = require("../models/contactModel");

const getContact = async (req, res) => {
  try {

    const { page = 1, limit = 10, search = "", tag } = req.body;

    // Pagination options
    const skip = (page - 1) * limit;

    // Build the search query
    const query = {};
    if (search) {
      query.$or = [
        { firstname: { $regex: search, $options: "i" } },  // Search in first name
        { lastname: { $regex: search, $options: "i" } },    // Search in last name
        {
          // Search in emailaddresses array
          emailaddresses: {
            $elemMatch: { $regex: search, $options: "i" },
          },
        },
        {
          // Search in phonenumbers array of objects
          phonenumbers: {
            $elemMatch: {
              number: { $regex: search, $options: "i" },
            },
          },
        },
      ];
    }
    // Handling tags
    if (tag) {
      if (Array.isArray(tag)) {
        // Multiple tags filter
        query.tags = { $elemMatch: { tag: { $in: tag } } };
      } else {
        // Single tag filter
        query.tags = { $elemMatch: { tag: tag } };
      }
    }


    // Fetching data with pagination and filtering
    const contacts = await Contact.find(query)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalCount = await Contact.countDocuments(query);

    res.json({
    const { page = 1, limit = 10, search="" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const searchFilter = search
    ? { 
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } }
        ]
      }
    : {};
  
    const contacts = await Contact.find({ createdBy: req?.user?._id, ...searchFilter })
      .select("-_id -createdBy -createdAt -updatedAt -__v")
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const formattedContacts = contacts.map((contact) => ({
      ...contact,
      tags: contact.tags.map((tagObj) => tagObj.tag),
    }));

    if (!formattedContacts) {
      return res
        .status(404)
        .json({ status: "error", message: "No contacts found" });
    }
    res.status(200).json({
      status: "success",
      data: formattedContacts,
      message: "Contacts fetched successfully",
    });
  } catch {
    res
      .status(500)
      .json({ status: "error", message: "Error fetching contacts" });
  }
};

module.exports = { getContact };
