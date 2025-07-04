const Contact = require("../models/contactModel");

const getContact = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      tag,
      isFavourite = false,
      favouriteContactsPage = 1,
      favouriteContactsLimit = 10,
      favouriteContactsSearch = ""
    } = req.body;

    const skip = (page - 1) * limit;
    const favouriteContactsSkip = (favouriteContactsPage - 1) * favouriteContactsLimit;

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

      if (favouriteContactsSearch?.trim()) {
        favQuery.$or = [
          { firstname: { $regex: favouriteContactsSearch, $options: "i" } },
          { lastname: { $regex: favouriteContactsSearch, $options: "i" } },
          { emailaddresses: { $elemMatch: { $regex: favouriteContactsSearch, $options: "i" } } },
          { phonenumbers: { $elemMatch: { number: { $regex: favouriteContactsSearch, $options: "i" } } } }
        ];
      }

      const rawFavouriteContacts = await Contact.find(favQuery)
        .sort({ createdAt: -1 }) // Show newest first
        .skip(favouriteContactsSkip)
        .limit(parseInt(favouriteContactsLimit))
        .select("-_id -createdBy -updatedAt -__v");

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
          contactObj.tags = contactObj.tags.map((tagObj) => ({
            tag: tagObj.tag,
            emoji: tagObj.emoji
          }));
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
          currentPage: parseInt(favouriteContactsPage),
          totalPages: Math.ceil(totalFavCount / favouriteContactsLimit),
          totalContacts: totalFavCount,
        },
        // },
      });
    }

    // Normal all contact fetch
    const rawContacts = await Contact.find(baseQuery)
      .sort({ createdAt: -1 }) // Show newest first
      .skip(skip)
      .limit(parseInt(limit))
      .select("-_id -createdBy -updatedAt -__v");

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
        contactObj.tags = contactObj.tags.map((tagObj) => ({
          tag: tagObj.tag,
          emoji: tagObj.emoji
        }));
      }
      // console.log(contactObj.meetings);
      // console.log(contactObj.meetings.length);

      return contactObj;
    });

    const totalMeetings = contacts.reduce((count, contact) => {
      return count + (Array.isArray(contact.meetings) ? contact.meetings.length : 0);
    }, 0);

    const totalCount = await Contact.countDocuments(baseQuery);

    res.json({
      status: "success",
      message: "Contacts fetched successfully",
      data: contacts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalContacts: totalCount,
        totalMeetings: totalMeetings,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

module.exports = { getContact };

