const Contact = require("../models/contactModel");
const User = require("../models/userModel");

const getUserData = async (req, res) => {
  try {
    const data = await User.findById(req.user._id).select("-createdAt -updatedAt -__v -salt -password")
    .lean();
    const contactCount = await Contact.countDocuments({ createdBy: data._id });
    const favouriteCount = await Contact.countDocuments({
      createdBy: data._id,
      isFavourite: true,
    });
    const tagCountValue = await User.aggregate([
          { $match: { _id: data._id } },
          { $unwind: "$tags" },
          { $count: "tagCount" },
        ]);

        const tagCount = tagCountValue.length > 0 ? tagCountValue[0].tagCount : 0;
        data.contactCount = contactCount;
        data.favouriteCount = favouriteCount;
        data.tagCount = tagCount;

        if (data) {
          data.id = data._id;
          delete data._id;
        }
        if (data && data.tags) {
          data.tags.forEach((tag) => {
            delete tag._id;
          });
        }
    // res.status(200).json({ data });
    return res.json({
      status: "success",
      message: "User fetched successfully.",
      data,
    });
  } catch {
    res.status(500).json({ message: "Error fetching the User" });
  }
};

module.exports = { getUserData };
