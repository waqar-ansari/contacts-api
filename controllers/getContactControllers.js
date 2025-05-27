const Contact = require("../models/contactModel");

const getContact = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      tag,
      isFavourite = false,
      favoriteContactsPage = 1,
      favoriteContactsLimit = 10,
      favoriteContactsSearch = ""
    } = req.body;

    const skip = (page - 1) * limit;
    const favoriteContactsSkip = (favoriteContactsPage - 1) * favoriteContactsLimit;

    // Base query
    const baseQuery = {
      createdBy: req.user._id,
    };

    // Optional search filter
    if (search?.trim()) {
      baseQuery.$or = [
        { firstname: { $regex: search, $options: "i" } },
        { lastname: { $regex: search, $options: "i" } },
        { emailaddresses: { $elemMatch: { $regex: search, $options: "i" } } },
        { phonenumbers: { $elemMatch: { number: { $regex: search, $options: "i" } } } }
      ];
    }

    // Optional tag filter
    if (Array.isArray(tag) && tag.length > 0) {
      baseQuery["tags.tag"] = { $all: tag };
    } else if (typeof tag === "string" && tag.trim() !== "") {
      baseQuery["tags.tag"] = tag.trim();
    }

    // If request is only for favourite contacts
    if (isFavourite === true || isFavourite === "true") {
      const favQuery = {
        ...baseQuery,
        isFavourite: true,
      };

      if (favoriteContactsSearch?.trim()) {
        favQuery.$or = [
          { firstname: { $regex: favoriteContactsSearch, $options: "i" } },
          { lastname: { $regex: favoriteContactsSearch, $options: "i" } },
          { emailaddresses: { $elemMatch: { $regex: favoriteContactsSearch, $options: "i" } } },
          { phonenumbers: { $elemMatch: { number: { $regex: favoriteContactsSearch, $options: "i" } } } }
        ];
      }

      const rawFavouriteContacts = await Contact.find(favQuery)
        .skip(favoriteContactsSkip)
        .limit(parseInt(favoriteContactsLimit))
        .select("-_id -createdBy -createdAt -updatedAt -__v");

      const favouriteContacts = rawFavouriteContacts.map((contact) => {
        const contactObj = contact.toObject();

        contactObj.emailaddresses = (Array.isArray(contactObj.emailaddresses)
          ? contactObj.emailaddresses.filter(email => email && email.trim() !== "")
          : []);

        // Clean phonenumbers (array of objects with .number)
        contactObj.phonenumbers = (Array.isArray(contactObj.phonenumbers)
          ? contactObj.phonenumbers.filter(number => number && number.trim() !== "")
          : []);

        if (Array.isArray(contactObj.tags)) {
          contactObj.tags = contactObj.tags.map((tagObj) => tagObj.tag);
        }
        return contactObj;
      });

      const totalFavCount = await Contact.countDocuments(favQuery);

      return res.json({
        status: "success",
        message: "Favourite contacts fetched successfully",
        // favouriteContacts: {
        data: favouriteContacts,
        pagination: {
          currentPage: parseInt(favoriteContactsPage),
          totalPages: Math.ceil(totalFavCount / favoriteContactsLimit),
          totalContacts: totalFavCount,
        },
        // },
      });
    }

    // Normal all contact fetch
    const rawContacts = await Contact.find(baseQuery)
      .skip(skip)
      .limit(parseInt(limit))
      .select("-_id -createdBy -createdAt -updatedAt -__v");

    const contacts = rawContacts.map((contact) => {
      const contactObj = contact.toObject();

      contactObj.emailaddresses = (Array.isArray(contactObj.emailaddresses)
        ? contactObj.emailaddresses.filter(email => email && email.trim() !== "")
        : []);

      // Clean phonenumbers (array of objects with .number)
      contactObj.phonenumbers = (Array.isArray(contactObj.phonenumbers)
        ? contactObj.phonenumbers.filter(number => number && number.trim() !== "")
        : []);

      if (Array.isArray(contactObj.tags)) {
        contactObj.tags = contactObj.tags.map((tagObj) => tagObj.tag);
      }
      return contactObj;
    });

    const totalCount = await Contact.countDocuments(baseQuery);

    res.json({
      status: "success",
      message: "Contacts fetched successfully",
      data: contacts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalContacts: totalCount,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

module.exports = { getContact };

