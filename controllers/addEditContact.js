const Contact = require("../models/contactModel");
const addEditContact = async (req, res) => {

  const {
    contact_id,
    firstname,
    lastname,
    email,
    mobilenumber,
    contactImageURL,
    isFavourite,
    tags,
  } = req.body;
//   const contact = await Contact.create({
//     firstname,
//     lastname,
//     email,
//     mobilenumber,
//     contactImageURL,
//     isFavourite,
//     tags,
//     createdBy: req.user._id,
//   });
//   const populatedContact = await Contact.findById(contact._id).populate(
//     "createdBy"
//   );
//   res
//     .status(201)
//     .json({
//       message: "Contact created successfully",
//       contact: populatedContact,
//     });
// };


try {
  if (contact_id === 0) {
    // Create a new contact
    const newContact = new Contact({
      firstname,
      lastname,
      emailaddresses,
      phonenumbers,
      contactImageURL,
      isFavourite,
      tags,
      createdBy,
    });

    // Find the highest contact_id and increment it for a new one
    const lastContact = await Contact.findOne().sort({ contact_id: -1 });
    newContact.contact_id = lastContact ? lastContact.contact_id + 1 : 1;

    const savedContact = await newContact.save();
    return res.status(201).json({ message: "Contact created successfully", contact: savedContact });

  } else {
    // Update existing contact
    const updatedContact = await Contact.findOneAndUpdate(
      { contact_id },
      {
        firstname,
        lastname,
        emailaddresses,
        phonenumbers,
        contactImageURL,
        isFavourite,
        tags,
      },
      { new: true }
    );

    if (!updatedContact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    return res.status(200).json({ message: "Contact updated successfully", contact: updatedContact });
  }
} catch (error) {
  return res.status(500).json({ message: "Server error", error: error.message });
}
};

module.exports = { addEditContact };
