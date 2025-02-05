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
    let data;
    if (contact_id === "0") {
      data = await Contact.create({
        firstname,
        lastname,
        emailaddresses,
        phonenumbers,
        contactImageURL,
        isFavourite,
        tags,
        createdBy: req.user._id,
      });
      data.contact_id = data._id;
      await data.save();

      const newContact = {
        contact_id: data._id,
        firstname: data.firstname,
        lastname: data.lastname,
        emailaddresses: data.emailaddresses,
        phonenumbers: data.phonenumbers,
        contactImageURL: data.contactImageURL,
        isFavourite: data.isFavourite,
        tags: data.tags,
      };
      res.status(201).json({
        message: "Contact created successfully",
        contact: newContact,
      });
    } else {
      // Update an existing contact
      data = await Contact.findOneAndUpdate(
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

      if (!data) {
        return res
          .status(404)
          .json({ message: "Contact not found or unauthorized access" });
      }

      const updatedContact = {
        contact_id: data._id,
        firstname: data.firstname,
        lastname: data.lastname,
        emailaddresses: data.emailaddresses,
        phonenumbers: data.phonenumbers,
        contactImageURL: data.contactImageURL,
        isFavourite: data.isFavourite,
        tags: data.tags,
      };

      res.status(200).json({
        message: "Contact updated successfully",
        data: updatedContact,
      });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "An error occurred", error: error.message });
  }
};

module.exports = { addEditContact };