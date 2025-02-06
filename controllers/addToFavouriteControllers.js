const Contact = require("../models/contactModel");

const addToFavourite = async (req, res) => {
  try {
    const { contact_id } = req.body;
    const contact = await Contact.findOne({ contact_id });
    contact.isFavourite = !contact.isFavourite;
    await contact.save();
    const favouriteCount = await Contact.countDocuments({
      createdBy: req.user._id,
      isFavourite: true,
    });
    res.send({
      message: contact.isFavourite
        ? "Added to Favourite"
        : "Removed from Favourite",
      favouriteCount,
    });
  } catch {
    res.status(500).json({ message: "Favourite toggle failed" });
  }
};

module.exports = { addToFavourite };
