const Contact = require("../models/contactModel");

const getContact = async (req, res) => {
  try {


    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const contacts = await Contact.find({ createdBy: req?.user?._id })
      .select("-_id -createdBy -createdAt -updatedAt -__v")
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const formattedContacts = contacts.map((contact) => ({
      ...contact,
      tags: contact.tags.map((tagObj) => tagObj.tag),//gives array of tags
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
