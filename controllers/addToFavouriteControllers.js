const Contact = require("../models/contactModel");

const addToFavourite = async (req, res) => {
  try {
    const { contact_id } = req.body;
    const contact = await Contact.findOne({ contact_id });
    contact.isFavourite = !contact.isFavourite;
    await contact.save();
    res.send({message:contact.isFavourite?"Added to Favourite":"Removed from Favourite"});
  } catch {
    res.status(500).json({ message: "Favourite toggle failed" });
  }
};

module.exports = { addToFavourite };
