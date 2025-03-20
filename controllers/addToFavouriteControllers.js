const Contact = require("../models/contactModel");

const addToFavourite = async (req, res) => {
  try {
    const { contact_id } = req.body;
    const contact = await Contact.findOne({ contact_id });
    if (!contact) {
      return res.status(404).json({ message: "Contact not found",status: "error" });
    }
    contact.isFavourite = !contact.isFavourite;
    await contact.save();
    const favouriteCount = await Contact.countDocuments({
      createdBy: req.user._id,
      isFavourite: true,
    });
    res.status(200).json({
      message: contact.isFavourite
        ? "Added to Favourite"
        : "Removed from Favourite",
      favouriteCount,
      status:"success"
    });
  } catch (error){
    res.status(500).json({ message: "Favourite toggle failed",status: "error" });
  }
};

module.exports = { addToFavourite };
