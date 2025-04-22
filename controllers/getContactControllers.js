const Contact = require("../models/contactModel");

const getContact = async (req, res) => {
  try {
    const {page = 1, limit = 10, search, tag } = req.body;

    const skip = (page - 1) * limit;

    // Build the dynamic search query
    // const query = {};
    const query = {
      createdBy: req.user._id,
    };

    // Apply search filter if not empty
    if (search && search.trim() !== "") {
      query.$or = [
        { firstname: { $regex: search, $options: "i" } },
        { lastname: { $regex: search, $options: "i" } },
        {
          emailaddresses: {
            $elemMatch: { $regex: search, $options: "i" },
          },
        },
        {
          phonenumbers: {
            $elemMatch: {
              number: { $regex: search, $options: "i" },
            },
          },
        },
      ];
    }

    // Apply tag filter only if it's a non-empty array or string
    if (Array.isArray(tag) && tag.length > 0) {
      query.tags = { $elemMatch: { tag: { $in: tag } } };
    } else if (typeof tag === "string" && tag.trim() !== "") {
      query.tags = { $elemMatch: { tag: tag.trim() } };
    }

    // Fetch data with filters + pagination
    const rawContacts = await Contact.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .select("-_id -createdBy -createdAt -updatedAt -__v"); // omit these fields

    // Transform tags from array of objects to array of strings
    const contacts = rawContacts.map((contact) => {
      const contactObj = contact.toObject();
      if (Array.isArray(contactObj.tags)) {
        contactObj.tags = contactObj.tags.map((tagObj) => tagObj.tag);
      }
      return contactObj;
    });

    // Count total results for pagination info
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