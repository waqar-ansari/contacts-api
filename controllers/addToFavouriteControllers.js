const Contact = require("../models/contactModel");

const addToFavourite = async (req, res) => {
  try {
    const { contact_id } = req.body;
    const contact = await Contact.findOne({ contact_id });
    if (!contact) {
      return res
        .status(404)
        .json({ status: "error", message: "Contact not found" });
    }
    contact.isFavourite = !contact.isFavourite;
    await contact.save();
    const favouriteCount = await Contact.countDocuments({
      createdBy: req.user._id,
      isFavourite: true,
    });
    res.status(200).json({
      status: "success",
      message: contact.isFavourite
        ? "Added to Favourite"
        : "Removed from Favourite",
      data: favouriteCount,
    });
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", message: "Favourite toggle failed" });
  }
};

module.exports = { addToFavourite };
