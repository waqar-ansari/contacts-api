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
      status: "success",
      message: "Contacts fetched successfully",
      data: contacts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalContacts: totalCount,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};


module.exports = { getContact };
