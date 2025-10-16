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
      favouriteContactsSearch = "",
      apiType = "web"
    } = req.body;

    // -------------------------
    // NORMAL CONTACTS PAGINATION
    // -------------------------
    // let pageToUse = parseInt(page) || 1;
    let pageToUse = parseInt(page) || 1;

    // If search or tag filter applied, reset to first page
    if (
      (search && search.trim() !== "") ||
      (Array.isArray(tag) && tag.length > 0) ||
      (typeof tag === "string" && tag.trim() !== "")
    ) {
      // pageToUse = 1;
      pageToUse = parseInt(page) || 1;
    }


    // Build base query
    const baseQuery = { createdBy: req.user._id };

    // Search filter
    if (search?.trim()) {
      const fullNameRegex = new RegExp(`^${search.trim()}`, "i");
      baseQuery.$or = [
        { firstname: { $regex: search, $options: "i" } },
        { lastname: { $regex: search, $options: "i" } },
        { emailaddresses: { $elemMatch: { $regex: search, $options: "i" } } },
        // { phonenumbers: { $elemMatch: { $regex: search, $options: "i" } } },
        // { phonenumbers: { $elemMatch: { number: { $regex: search, $options: "i" } } } },
        {
          phonenumbers: {
            $elemMatch: {
              $or: [
                { countryCode: { $regex: search, $options: "i" } },
                { number: { $regex: search, $options: "i" } }
              ]
            }
          }
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

    // Tag filter
    if (Array.isArray(tag) && tag.length > 0) {
      baseQuery["tags"] = {
        $elemMatch: {
          tag: { $in: tag.map(t => new RegExp(`^${t}$`, "i")) }
        }
      };
    } else if (typeof tag === "string" && tag.trim() !== "") {
      baseQuery["tags.tag"] = { $regex: `^${tag.trim()}$`, $options: "i" };
    }

    // -------------------------
    // FAVOURITE CONTACTS MODE
    // -------------------------

    if (isFavourite === true || isFavourite === "true") {
      // let favPageToUse = parseInt(favouriteContactsPage) || 1;

      let favPageToUse = parseInt(favouriteContactsPage) || 1;

      // If favourite search or tag filter applied, reset to first page
      if (
        (favouriteContactsSearch && favouriteContactsSearch.trim() !== "") ||
        (Array.isArray(tag) && tag.length > 0) ||
        (typeof tag === "string" && tag.trim() !== "")
      ) {
        // favPageToUse = 1;
        favPageToUse = parseInt(page) || 1;
      }


      const favQuery = { createdBy: req.user._id, isFavourite: true };

      // ADD THIS — tag filter for favourites
      if (Array.isArray(tag) && tag.length > 0) {
        favQuery["tags"] = {
          $elemMatch: {
            tag: { $in: tag.map(t => new RegExp(`^${t}$`, "i")) }
          }
        };
      } else if (typeof tag === "string" && tag.trim() !== "") {
        favQuery["tags.tag"] = { $regex: `^${tag.trim()}$`, $options: "i" };
      }

      if (favouriteContactsSearch?.trim()) {
        const fullNameRegex = new RegExp(`^${favouriteContactsSearch.trim()}`, "i");
        favQuery.$or = [
          { firstname: { $regex: favouriteContactsSearch, $options: "i" } },
          { lastname: { $regex: favouriteContactsSearch, $options: "i" } },
          { emailaddresses: { $elemMatch: { $regex: favouriteContactsSearch, $options: "i" } } },
          { phonenumbers: { $elemMatch: { $regex: favouriteContactsSearch, $options: "i" } } },
          { phonenumbers: { $elemMatch: { number: { $regex: favouriteContactsSearch, $options: "i" } } } },
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

      const totalFavCount = await Contact.countDocuments(favQuery);
      const favTotalPages = Math.ceil(totalFavCount / favouriteContactsLimit);

      if (favPageToUse > favTotalPages) {
        favPageToUse = favTotalPages > 0 ? favTotalPages : 1;
      }

      const favouriteContactsSkip = (favPageToUse - 1) * favouriteContactsLimit;

      const rawFavouriteContacts = await Contact.find(favQuery)
        .sort(sorted ? { firstname: 1, lastname: 1 } : { createdAt: -1, _id: -1 })
        .skip(favouriteContactsSkip)
        .limit(parseInt(favouriteContactsLimit))
        .select("-_id -updatedAt -__v");

      const favouriteContacts = rawFavouriteContacts.map(contact => {
        const obj = contact.toObject();
        obj.emailaddresses = Array.isArray(obj.emailaddresses) ? obj.emailaddresses.filter(e => e?.trim()) : [];
        // obj.phonenumbers = Array.isArray(obj.phonenumbers) ? obj.phonenumbers.filter(n => n?.trim()) : [];
        // obj.phonenumbers = Array.isArray(obj.phonenumbers)
        //   ? obj.phonenumbers.filter(p => (p?.number && p.number.trim()) || (p?.countryCode && p.countryCode.trim()))
        //   : [];
        if (Array.isArray(obj.phonenumbers)) {
          const filteredPhones = obj.phonenumbers.filter(
            p => (p?.number && p.number.trim()) || (p?.countryCode && p.countryCode.trim())
          );

          if (apiType === "web") {
            // For web: combine countryCode + number as strings
            obj.phonenumbers = filteredPhones.map(p => {
              let cc = p.countryCode ? p.countryCode.trim() : "";
              let num = p.number ? p.number.trim() : "";
              return cc && num ? `${cc}${num}` : num || cc;
            });
          } else {
            // For mobile: keep original object format
            obj.phonenumbers = filteredPhones;
          }
        } else {
          obj.phonenumbers = [];
        }

        if (Array.isArray(obj.tags)) {
          obj.tags = obj.tags.map(t => ({ tag: t.tag, emoji: t.emoji }));
        }
        return obj;
      });

      return res.json({
        status: "success",
        message: "Favourite contacts fetched successfully",
        data: favouriteContacts,
        pagination: {
          currentPage: favPageToUse,
          totalPages: favTotalPages,
          totalContacts: totalFavCount
        }
      });
    }


    // -------------------------
    // NORMAL CONTACTS FETCH
    // -------------------------
    const totalCount = await Contact.countDocuments(baseQuery);
    const totalPages = Math.ceil(totalCount / limit);

    if (pageToUse > totalPages) {
      pageToUse = totalPages > 0 ? totalPages : 1;
    }

    const skip = (pageToUse - 1) * limit;

    const rawContacts = await Contact.find(baseQuery)
      .sort(sorted ? { firstname: 1, lastname: 1 } : { createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("-_id -updatedAt -__v");

    const contacts = rawContacts.map(contact => {
      const obj = contact.toObject();
      obj.emailaddresses = Array.isArray(obj.emailaddresses) ? obj.emailaddresses.filter(e => e?.trim()) : [];
      // obj.phonenumbers = Array.isArray(obj.phonenumbers) ? obj.phonenumbers.filter(n => n?.trim()) : [];
      // obj.phonenumbers = Array.isArray(obj.phonenumbers)
      //   ? obj.phonenumbers.filter(p => (p?.number && p.number.trim()) || (p?.countryCode && p.countryCode.trim()))
      //   : [];
      if (Array.isArray(obj.phonenumbers)) {
        const filteredPhones = obj.phonenumbers.filter(
          p => (p?.number && p.number.trim()) || (p?.countryCode && p.countryCode.trim())
        );

        if (apiType === "web") {
          // For web: combine countryCode + number as strings
          obj.phonenumbers = filteredPhones.map(p => {
            let cc = p.countryCode ? p.countryCode.trim() : "";
            let num = p.number ? p.number.trim() : "";
            return cc && num ? `${cc}${num}` : num || cc;
          });
        } else {
          // For mobile: keep original object format
          obj.phonenumbers = filteredPhones;
        }
      } else {
        obj.phonenumbers = [];
      }
      if (Array.isArray(obj.tags)) {
        obj.tags = obj.tags.map(t => ({ tag: t.tag, emoji: t.emoji }));
      }
      return obj;
    });

    const totalMeetings = contacts.reduce((count, contact) => {
      return count + (Array.isArray(contact.meetings) ? contact.meetings.length : 0);
    }, 0);

    res.json({
      status: "success",
      message: "Contacts Fetched",
      data: contacts,
      pagination: {
        currentPage: pageToUse,
        totalPages,
        totalContacts: totalCount,
        totalMeetings
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

module.exports = { getContact };
