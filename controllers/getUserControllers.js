// const Contact = require("../models/contactModel");
// const User = require("../models/userModel");

// const getUserData = async (req, res) => {
//   try {
//     const {
//       searchWhatsappTemplates = "",
//       searchEmailTemplates = "",
//       whatsappTemplatePage = 1,
//       whatsappTemplateLimit = 10,
//       emailTemplatePage = 1,
//       emailTemplateLimit = 10,
//       whatsappTemplateIsFavourite = false,
//       emailTemplateIsFavourite = false,
//       favouriteWhatsappTemplatesPage = 1,
//       favouriteWhastappTemplatesContactsLimit = 10,
//       favouriteWhatsappTemplatesContactsSearch = "",
//       favouriteEmailTemplatesPage = 1,
//       favouriteEmailTemplatesContactsLimit = 10,
//       favouriteEmailTemplatesContactsSearch = ""
//     } = req.body;

//     const data = await User.findById(req.user._id)
//       .select("-createdAt -updatedAt -__v -salt -password -tags -iScanned -scannedMe -reminders")
//       .lean();

//     const contactCount = await Contact.countDocuments({ createdBy: data._id });
//     const favouriteCount = await Contact.countDocuments({
//       createdBy: data._id,
//       isFavourite: true,
//     });

//     const tagCountValue = await User.aggregate([
//       { $match: { _id: data._id } },
//       { $unwind: "$tags" },
//       { $count: "tagCount" },
//     ]);
//     const tagCount = tagCountValue.length > 0 ? tagCountValue[0].tagCount : 0;

//     // Prepare user data
//     data.contactCount = contactCount;
//     data.favouriteCount = favouriteCount;
//     data.tagCount = tagCount;
//     data.id = data._id;
//     delete data._id;

//     if (data.tags) {
//       data.tags.forEach((tag) => delete tag._id);
//     }

//     const favouriteWhatsappTemplatesSkip = (favouriteWhatsappTemplatesPage - 1) * favouriteWhastappTemplatesContactsLimit;

//     const favouriteEmailTemplatesSkip = (favouriteEmailTemplatesPage - 1) * favouriteEmailTemplatesContactsLimit;

//     // WhatsApp Templates
//     let whatsappTemplates = Array.isArray(data.whatsappTemplates) ? data.whatsappTemplates : [];
//     if (searchWhatsappTemplates) {
//       const lowerSearch = searchWhatsappTemplates.toLowerCase();
//       whatsappTemplates = whatsappTemplates.filter((t) =>
//         (t.whatsappTemplateTitle || "").toLowerCase().includes(lowerSearch) ||
//         (t.whatsappTemplateMessage || "").toLowerCase().includes(lowerSearch)
//       );
//     }
//     const whatsappTotal = whatsappTemplates.length;
//     const whatsappTotalPages = Math.ceil(whatsappTotal / whatsappTemplateLimit);
//     const whatsappPaginated = whatsappTemplates.slice(
//       (whatsappTemplatePage - 1) * whatsappTemplateLimit,
//       whatsappTemplatePage * whatsappTemplateLimit
//     );

//     // Email Templates
//     let emailTemplates = Array.isArray(data.emailTemplates) ? data.emailTemplates : [];
//     if (searchEmailTemplates) {
//       const lowerSearch = searchEmailTemplates.toLowerCase();
//       emailTemplates = emailTemplates.filter((t) =>
//         (t.emailTemplateTitle || "").toLowerCase().includes(lowerSearch) ||
//         (t.emailTemplateSubject || "").toLowerCase().includes(lowerSearch) ||
//         (t.emailTemplateBody || "").toLowerCase().includes(lowerSearch)
//       );
//     }
//     const emailTotal = emailTemplates.length;
//     const emailTotalPages = Math.ceil(emailTotal / emailTemplateLimit);
//     const emailPaginated = emailTemplates.slice(
//       (emailTemplatePage - 1) * emailTemplateLimit,
//       emailTemplatePage * emailTemplateLimit
//     );

//     data.templates = {
//       whatsappTemplates: {
//         whatsappTemplatesData: whatsappPaginated,
//         whatsappTemplatePagination: {
//           currentPage: Number(whatsappTemplatePage),
//           totalPages: whatsappTotalPages,
//           totalTemplates: whatsappTotal
//         }
//       },
//       emailTemplates: {
//         emailTemplatesData: emailPaginated,
//         emailTemplatePagination: {
//           currentPage: Number(emailTemplatePage),
//           totalPages: emailTotalPages,
//           totalTemplates: emailTotal
//         }
//       }
//     };

//     delete data.whatsappTemplates;
//     delete data.emailTemplates;

//     return res.json({
//       status: "success",
//       message: "User fetched successfully.",
//       data,
//     });
//   } catch (error) {
//     console.error("Error fetching user:", error);
//     return res.status(500).json({
//       status: "error",
//       message: "Error fetching the User",
//     });
//   }
// };

// module.exports = { getUserData };

const Contact = require("../models/contactModel");
const User = require("../models/userModel");

const getUserData = async (req, res) => {
  try {
    const {
      searchWhatsappTemplates = "",
      searchEmailTemplates = "",
      whatsappTemplatePage = 1,
      whatsappTemplateLimit = 10,
      emailTemplatePage = 1,
      emailTemplateLimit = 10,
      whatsappTemplateIsFavourite,
      emailTemplateIsFavourite,
    } = req.body;

    const isWhatsappFav = whatsappTemplateIsFavourite === true || whatsappTemplateIsFavourite === "true";
    const isEmailFav = emailTemplateIsFavourite === true || emailTemplateIsFavourite === "true";

    const user = await User.findById(req.user._id).lean();

    if (!user) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    const responseData = {};

    const contactCount = await Contact.countDocuments({ createdBy: user._id });
    const favouriteCount = await Contact.countDocuments({ createdBy: user._id, isFavourite: true });
    const totalWhatsappTemplates = Array.isArray(user.whatsappTemplates) ? user.whatsappTemplates.length : 0;
    const totalEmailTemplates = Array.isArray(user.emailTemplates) ? user.emailTemplates.length : 0;
    const totalTemplates = totalWhatsappTemplates + totalEmailTemplates;

    const totalScans =
      (Array.isArray(user.iScanned) ? user.iScanned.length : 0) +
      (Array.isArray(user.scannedMe) ? user.scannedMe.length : 0);

    const whoScannedMeCount = Array.isArray(user.scannedMe) ? user.scannedMe.length : 0;

    const tagCountAgg = await User.aggregate([
      { $match: { _id: user._id } },
      { $unwind: "$tags" },
      { $count: "tagCount" },
    ]);
    const tagCount = tagCountAgg.length > 0 ? tagCountAgg[0].tagCount : 0;

    // Only return WhatsApp templates if specifically requested
    if (isWhatsappFav && !isEmailFav) {
      let whatsappTemplates = Array.isArray(user.whatsappTemplates) ? user.whatsappTemplates : [];
      whatsappTemplates = whatsappTemplates.filter(t => t.whatsappTemplateIsFavourite === true);

      if (searchWhatsappTemplates.trim()) {
        const search = searchWhatsappTemplates.toLowerCase();
        whatsappTemplates = whatsappTemplates.filter(t =>
          (t.whatsappTemplateTitle || "").toLowerCase().includes(search) ||
          (t.whatsappTemplateMessage || "").toLowerCase().includes(search)
        );
      }

      const total = whatsappTemplates.length;
      const totalPages = Math.ceil(total / whatsappTemplateLimit);
      const paginated = whatsappTemplates.slice(
        (whatsappTemplatePage - 1) * whatsappTemplateLimit,
        whatsappTemplatePage * whatsappTemplateLimit
      );

      return res.json({
        status: "success",
        message: "Favourite WhatsApp templates fetched successfully.",
        data: {
          id: user._id,
          firstname: user.firstname,
          lastname: user.lastname,
          phonenumbers: user.phonenumbers,
          serialNumber: user.serialNumber,
          email: user.email,
          profileImageURL: user.profileImageURL,
          qrCode: user.qrCode,
          contactCount,
          favouriteCount,
          totalTemplates,
          totalScans,
          whoScannedMeCount,
          tagCount,
          "templates": {
            whatsappTemplates: {
              whatsappTemplatesData: paginated,
              whatsappTemplatePagination: {
                currentPage: Number(whatsappTemplatePage),
                totalPages,
                totalTemplates: total,
              },
            },
          },
        },
      });
    }

    // Only return Email templates if specifically requested
    if (isEmailFav && !isWhatsappFav) {
      let emailTemplates = Array.isArray(user.emailTemplates) ? user.emailTemplates : [];
      emailTemplates = emailTemplates.filter(t => t.emailTemplateIsFavourite === true);

      if (searchEmailTemplates.trim()) {
        const search = searchEmailTemplates.toLowerCase();
        emailTemplates = emailTemplates.filter(t =>
          (t.emailTemplateTitle || "").toLowerCase().includes(search) ||
          (t.emailTemplateSubject || "").toLowerCase().includes(search) ||
          (t.emailTemplateBody || "").toLowerCase().includes(search)
        );
      }

      const total = emailTemplates.length;
      const totalPages = Math.ceil(total / emailTemplateLimit);
      const paginated = emailTemplates.slice(
        (emailTemplatePage - 1) * emailTemplateLimit,
        emailTemplatePage * emailTemplateLimit
      );

      return res.json({
        status: "success",
        message: "Favourite Email templates fetched successfully.",
        data: {
          id: user._id,
          firstname: user.firstname,
          lastname: user.lastname,
          phonenumbers: user.phonenumbers,
          serialNumber: user.serialNumber,
          email: user.email,
          profileImageURL: user.profileImageURL,
          qrCode: user.qrCode,
          contactCount,
          favouriteCount,
          totalTemplates,
          totalScans,
          whoScannedMeCount,
          tagCount,
          "templates": {
            emailTemplates: {
              emailTemplatesData: paginated,
              emailTemplatePagination: {
                currentPage: Number(emailTemplatePage),
                totalPages,
                totalTemplates: total,
              },
            },
          },

        },
      });
    }

    // If no specific favourite flags provided, return full data


    const data = {
      id: user._id,
      firstname: user.firstname,
      lastname: user.lastname,
      phonenumbers: user.phonenumbers,
      serialNumber: user.serialNumber,
      email: user.email,
      profileImageURL: user.profileImageURL,
      qrCode: user.qrCode,
      contactCount,
      favouriteCount,
      totalTemplates,
      totalScans,
      whoScannedMeCount,
      tagCount,
      templates: {}
    };

    // WhatsApp Templates
    let whatsappTemplates = Array.isArray(user.whatsappTemplates) ? user.whatsappTemplates : [];
    if (searchWhatsappTemplates.trim()) {
      const search = searchWhatsappTemplates.toLowerCase();
      whatsappTemplates = whatsappTemplates.filter(t =>
        (t.whatsappTemplateTitle || "").toLowerCase().includes(search) ||
        (t.whatsappTemplateMessage || "").toLowerCase().includes(search)
      );
    }
    const totalWhatsapp = whatsappTemplates.length;
    const totalWhatsappPages = Math.ceil(totalWhatsapp / whatsappTemplateLimit);
    const paginatedWhatsapp = whatsappTemplates.slice(
      (whatsappTemplatePage - 1) * whatsappTemplateLimit,
      whatsappTemplatePage * whatsappTemplateLimit
    );

    // Email Templates
    let emailTemplates = Array.isArray(user.emailTemplates) ? user.emailTemplates : [];
    if (searchEmailTemplates.trim()) {
      const search = searchEmailTemplates.toLowerCase();
      emailTemplates = emailTemplates.filter(t =>
        (t.emailTemplateTitle || "").toLowerCase().includes(search) ||
        (t.emailTemplateSubject || "").toLowerCase().includes(search) ||
        (t.emailTemplateBody || "").toLowerCase().includes(search)
      );
    }
    const totalEmail = emailTemplates.length;
    const totalEmailPages = Math.ceil(totalEmail / emailTemplateLimit);
    const paginatedEmail = emailTemplates.slice(
      (emailTemplatePage - 1) * emailTemplateLimit,
      emailTemplatePage * emailTemplateLimit
    );

    data.templates.whatsappTemplates = {
      whatsappTemplatesData: paginatedWhatsapp,
      whatsappTemplatePagination: {
        currentPage: Number(whatsappTemplatePage),
        totalPages: totalWhatsappPages,
        totalTemplates: totalWhatsapp,
      },
    };

    data.templates.emailTemplates = {
      emailTemplatesData: paginatedEmail,
      emailTemplatePagination: {
        currentPage: Number(emailTemplatePage),
        totalPages: totalEmailPages,
        totalTemplates: totalEmail,
      },
    };

    return res.json({
      status: "success",
      message: "User and templates fetched successfully.",
      data,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error.",
    });
  }
};

module.exports = { getUserData };

