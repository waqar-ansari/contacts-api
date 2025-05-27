const Contact = require("../models/contactModel");

const getContact = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, tag, favoriteContactsPage = 1, favoriteContactsLimit = 10, favoriteContactsSearch } = req.body;

    const skip = (page - 1) * limit;
    const favoriteContactsSkip = (favoriteContactsPage - 1) * favoriteContactsLimit;

    // Base query for all contacts
    const query = {
      createdBy: req.user._id,
    };

    // Apply search filter if not empty
    if (search && search.trim() !== "") {
      query.$or = [
        { firstname: { $regex: search, $options: "i" } },
        { lastname: { $regex: search, $options: "i" } },
        {
          emailaddresses: {
            $elemMatch: { $regex: search, $options: "i" },
          },
        },
        {
          phonenumbers: {
            $elemMatch: {
              number: { $regex: search, $options: "i" },
            },
          },
        },
      ];
    }

    // Apply tag filter
    if (Array.isArray(tag) && tag.length > 0) {
      query["tags.tag"] = { $all: tag };
    } else if (typeof tag === "string" && tag.trim() !== "") {
      query["tags.tag"] = tag.trim();
    }

    // Fetch contacts
    const rawContacts = await Contact.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .select("-_id -createdBy -createdAt -updatedAt -__v");

    const contacts = rawContacts.map((contact) => {
      const contactObj = contact.toObject();
      if (Array.isArray(contactObj.tags)) {
        contactObj.tags = contactObj.tags.map((tagObj) => tagObj.tag);
      }
      return contactObj;
    });

    const totalCount = await Contact.countDocuments(query);

    // ============ FAVOURITE CONTACTS SECTION =============
    const favQuery = {
      createdBy: req.user._id,
      isFavourite: true,
    };

    if (favoriteContactsSearch && favoriteContactsSearch.trim() !== "") {
      favQuery.$or = [
        { firstname: { $regex: favoriteContactsSearch, $options: "i" } },
        { lastname: { $regex: favoriteContactsSearch, $options: "i" } },
        {
          emailaddresses: {
            $elemMatch: { $regex: favoriteContactsSearch, $options: "i" },
          },
        },
        {
          phonenumbers: {
            $elemMatch: {
              number: { $regex: favoriteContactsSearch, $options: "i" },
            },
          },
        },
      ];
    }

    const rawFavouriteContacts = await Contact.find(favQuery)
      .skip(favoriteContactsSkip)
      .limit(parseInt(favoriteContactsLimit))
      .select("-_id -createdBy -createdAt -updatedAt -__v");

    const favouriteContacts = rawFavouriteContacts.map((contact) => {
      const contactObj = contact.toObject();
      if (Array.isArray(contactObj.tags)) {
        contactObj.tags = contactObj.tags.map((tagObj) => tagObj.tag);
      }
      return contactObj;
    });

    const totalFavCount = await Contact.countDocuments(favQuery);

    // =======================================================

    res.json({
      status: "success",
      message: "Contacts fetched successfully",
      data: contacts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalContacts: totalCount,
      },
      favouriteContacts: {
        data: favouriteContacts,
        favouriteContactsPagination: {
          currentPage: parseInt(favoriteContactsPage),
          totalPages: Math.ceil(totalFavCount / favoriteContactsLimit),
          totalContacts: totalFavCount,
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

module.exports = { getContact };
