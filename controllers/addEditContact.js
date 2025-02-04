const { mongoose } = require("mongoose");
const Contact = require("../models/contactModel");

const addEditContact = async (req, res) => {
  const {
    contact_id,
    firstname,
    lastname,
    emailaddresses,
    phonenumbers,
    contactImageURL,
    isFavourite,
    tags,
  } = req.body;

  try {
    let contact;
    if (contact_id === "0") {
      contact = await Contact.create({
        firstname,
        lastname,
        emailaddresses,
        phonenumbers,
        contactImageURL,
        isFavourite,
        tags,
        createdBy: req.user._id,
      });
      contact.contact_id = contact._id;
      await contact.save();
      // Populate the created contact
      // const populatedContact = await Contact.findById(contact._id).populate(
      //   "createdBy"
      // );
      const newContact = {
        contact_id: contact._id,
        firstname: contact.firstname,
        lastname: contact.lastname,
        emailaddresses: contact.emailaddresses,
        phonenumbers: contact.phonenumbers,
        contactImageURL: contact.contactImageURL,
        isFavourite: contact.isFavourite,
        tags: contact.tags,
      };
      res.status(201).json({
        message: "Contact created successfully",
        contact: newContact,
      });
    } else {
      // Update an existing contact
      contact = await Contact.findOneAndUpdate(
        { _id: contact_id, createdBy: req.user._id },
        {
          firstname,
          lastname,
          emailaddresses,
          phonenumbers,
          contactImageURL,
          isFavourite,
          tags,
        },
        { new: true } // Return the updated document
      ).populate("createdBy");

      if (!contact) {
        return res
          .status(404)
          .json({ message: "Contact not found or unauthorized access" });
      }

      const updatedContact = {
        contact_id: contact._id,
        firstname: contact.firstname,
        lastname: contact.lastname,
        emailaddresses: contact.emailaddresses,
        phonenumbers: contact.phonenumbers,
        contactImageURL: contact.contactImageURL,
        isFavourite: contact.isFavourite,
        tags: contact.tags,
      };

      res.status(200).json({
        message: "Contact updated successfully",
        contact: updatedContact,
      });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "An error occurred", error: error.message });
  }
};

module.exports = { addEditContact };
