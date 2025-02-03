const Contact = require("../models/contactModel");
const addEditContact = async (req, res) => {
  console.log("User ID: ", req.user); // Debugging user ID
  const {
    firstname,
    lastname,
    email,
    mobilenumber,
    contactImageURL,
    isFavourite,
    tags,
  } = req.body;
  const contact = await Contact.create({
    firstname,
    lastname,
    email,
    mobilenumber,
    contactImageURL,
    isFavourite,
    tags,
    createdBy: req.user._id,
  });
  const populatedContact = await Contact.findById(contact._id).populate(
    "createdBy"
  );
  res
    .status(201)
    .json({
      message: "Contact created successfully",
      contact: populatedContact,
    });
};

module.exports = { addEditContact };
