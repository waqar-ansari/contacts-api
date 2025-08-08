const Contact = require("../models/contactModel");

const getContact = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      tag,
      sorted,
      isFavourite = false,
      favouriteContactsPage = 1,
      favouriteContactsLimit = 10,
      favouriteContactsSearch = ""
    } = req.body;

    // const skip = (page - 1) * limit;
    // let pageToUse = page;
    // if (search?.trim() && page > 1) {
    //   pageToUse = 1;
    // }
    // let pageToUse = parseInt(page);

    let pageToUse = parseInt(page);

    if (
      (search?.trim() && pageToUse > 1) ||
      ((Array.isArray(tag) && tag.length > 0) || (typeof tag === "string" && tag.trim() !== "")) && pageToUse > 1
    ) {
      pageToUse = 1;
    }



    // let favPageToUse = favouriteContactsPage;
    // if (favouriteContactsSearch?.trim() && favouriteContactsPage > 1) {
    //   favPageToUse = 1;
    // }
    // let favPageToUse = parseInt(favouriteContactsPage);
    let favPageToUse = parseInt(favouriteContactsPage);

    if (favouriteContactsSearch?.trim() && favPageToUse > 1) {
      favPageToUse = 1;
    }

    const skip = (pageToUse - 1) * limit;
    // const favouriteContactsSkip = (favouriteContactsPage - 1) * favouriteContactsLimit;
    const favouriteContactsSkip = (favPageToUse - 1) * favouriteContactsLimit;


    // Base query
    const baseQuery = {
      createdBy: req.user._id,
    };

    // Optional search filter
    if (search?.trim()) {
      const fullNameRegex = new RegExp(`^${search.trim()}`, "i");

      baseQuery.$or = [
        { firstname: { $regex: search, $options: "i" } },
        { lastname: { $regex: search, $options: "i" } },
        { emailaddresses: { $elemMatch: { $regex: search, $options: "i" } } },
        // { phonenumbers: { $elemMatch: { number: { $regex: search, $options: "i" } } } },
        {
          $or: [
            { phonenumbers: { $elemMatch: { $regex: search, $options: "i" } } }, // if phonenumbers is array of strings
            { phonenumbers: { $elemMatch: { number: { $regex: search, $options: "i" } } } }, // if array of objects with .number
          ]
        },
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ["$firstname", " ", "$lastname"] },
              regex: fullNameRegex,
            }
          }
        }

      ];
    }

    // // Optional tag filter
    // if (Array.isArray(tag) && tag.length > 0) {
    //   baseQuery["tags.tag"] = { $all: tag };
    // } else if (typeof tag === "string" && tag.trim() !== "") {
    //   baseQuery["tags.tag"] = tag.trim();
    // }

    if (Array.isArray(tag) && tag.length > 0) {
      baseQuery["tags"] = {
        $all: tag.map((t) => ({
          $elemMatch: { tag: { $regex: `^${t}$`, $options: "i" } }
        }))
      };
    } else if (typeof tag === "string" && tag.trim() !== "") {
      baseQuery["tags.tag"] = { $regex: `^${tag.trim()}$`, $options: "i" };
    }


    // If request is only for favourite contacts
    if (isFavourite === true || isFavourite === "true") {
      const favQuery = {
        ...baseQuery,
        isFavourite: true,
      };

      if (favouriteContactsSearch?.trim()) {
        const fullNameRegex = new RegExp(`^${favouriteContactsSearch.trim()}`, "i");

        favQuery.$or = [
          { firstname: { $regex: favouriteContactsSearch, $options: "i" } },
          { lastname: { $regex: favouriteContactsSearch, $options: "i" } },
          { emailaddresses: { $elemMatch: { $regex: favouriteContactsSearch, $options: "i" } } },
          // { phonenumbers: { $elemMatch: { number: { $regex: favouriteContactsSearch, $options: "i" } } } }
          {
            $or: [
              { phonenumbers: { $elemMatch: { $regex: favouriteContactsSearch, $options: "i" } } },
              { phonenumbers: { $elemMatch: { number: { $regex: favouriteContactsSearch, $options: "i" } } } },
            ]
          },
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ["$firstname", " ", "$lastname"] },
                regex: fullNameRegex,
              }
            }
          }
        ];
      }

      const rawFavouriteContacts = await Contact.find(favQuery)
        // .sort({ createdAt: -1 }) // Show newest first
        // .sort({ createdAt: -1, _id: -1 })
        .sort(sorted === true || sorted === "true" ? { firstname: 1, lastname: 1 } : { createdAt: -1, _id: -1 })
        .skip(favouriteContactsSkip)
        .limit(parseInt(favouriteContactsLimit))
        .select("-_id -updatedAt -__v");

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
          // currentPage: parseInt(favouriteContactsPage),
          currentPage: parseInt(favPageToUse),
          totalPages: Math.ceil(totalFavCount / favouriteContactsLimit),
          totalContacts: totalFavCount,
        },
        // },
      });
    }

    // Normal all contact fetch
    const rawContacts = await Contact.find(baseQuery)
      // .sort({ createdAt: -1 }) // Show newest first
      // .sort({ createdAt: -1, _id: -1 })
      .sort(sorted === true || sorted === "true" ? { firstname: 1, lastname: 1 } : { createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("-_id -updatedAt -__v");

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
        // currentPage: parseInt(page),
        currentPage: parseInt(pageToUse),
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