// const Contact = require("../models/contactModel");
// const User = require("../models/userModel");

// const getUserData = async (req, res) => {
//   try {
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

//     // Prepare basic data
//     data.contactCount = contactCount;
//     data.favouriteCount = favouriteCount;
//     data.tagCount = tagCount;

//     if (data) {
//       data.id = data._id;
//       delete data._id;
//     }

//     if (data && data.tags) {
//       data.tags.forEach((tag) => {
//         delete tag._id;
//       });
//     }

//     // Handle WhatsApp templates
//     let whatsappFavouriteTemplates = [];
//     let whatsappAllTemplates = [];
//     if (Array.isArray(data.whatsappTemplates)) {
//       whatsappAllTemplates = data.whatsappTemplates;
//       whatsappFavouriteTemplates = data.whatsappTemplates.filter(
//         (template) => template.whatsappTemplateIsFavourite === true
//       );
//     }

//     // Handle Email templates
//     let emailFavouriteTemplates = [];
//     let emailAllTemplates = [];
//     if (Array.isArray(data.emailTemplates)) {
//       emailAllTemplates = data.emailTemplates;
//       emailFavouriteTemplates = data.emailTemplates.filter(
//         (template) => template.emailTemplateIsFavourite === true
//       );
//     }

//     // Final structure: put all templates inside `data.templates`
//     data.templates = {
//       whatsappTemplates: {
//         favourite: whatsappFavouriteTemplates,
//         allWhatsappTemplates: whatsappAllTemplates,
//       },
//       emailTemplates: {
//         favourite: emailFavouriteTemplates,
//         allEmailTemplates: emailAllTemplates,
//       },
//     };

//     // Remove original arrays from root
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
      search = "",
      whatsappTemplatePage = 1,
      whatsappTemplateLimit = 10,
      emailTemplatePage = 1,
      emailTemplateLimit = 10,
    } = req.body;

    const data = await User.findById(req.user._id)
      .select("-createdAt -updatedAt -__v -salt -password -tags -iScanned -scannedMe -reminders")
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

    // Prepare user data
    data.contactCount = contactCount;
    data.favouriteCount = favouriteCount;
    data.tagCount = tagCount;
    data.id = data._id;
    delete data._id;

    if (data.tags) {
      data.tags.forEach((tag) => delete tag._id);
    }

    // WhatsApp Templates
    let whatsappTemplates = Array.isArray(data.whatsappTemplates) ? data.whatsappTemplates : [];
    if (search) {
      whatsappTemplates = whatsappTemplates.filter((t) =>
        (t.title || "").toLowerCase().includes(search.toLowerCase())
      );
    }
    const whatsappTotal = whatsappTemplates.length;
    const whatsappFavourite = whatsappTemplates.filter(t => t.whatsappTemplateIsFavourite);
    const whatsappTotalPages = Math.ceil(whatsappTotal / whatsappTemplateLimit);
    const whatsappPaginated = whatsappTemplates.slice(
      (whatsappTemplatePage - 1) * whatsappTemplateLimit,
      whatsappTemplatePage * whatsappTemplateLimit
    );

    // Email Templates
    let emailTemplates = Array.isArray(data.emailTemplates) ? data.emailTemplates : [];
    if (search) {
      emailTemplates = emailTemplates.filter((t) =>
        (t.title || "").toLowerCase().includes(search.toLowerCase())
      );
    }
    const emailTotal = emailTemplates.length;
    const emailFavourite = emailTemplates.filter(t => t.emailTemplateIsFavourite);
    const emailTotalPages = Math.ceil(emailTotal / emailTemplateLimit);
    const emailPaginated = emailTemplates.slice(
      (emailTemplatePage - 1) * emailTemplateLimit,
      emailTemplatePage * emailTemplateLimit
    );

    data.templates = {
      whatsappTemplates: {
        // totalTemplate: whatsappTotal,
        favourite: whatsappFavourite,
        data: whatsappPaginated,
        whatsappTemplatePagination: {
          currentPage: Number(whatsappTemplatePage),
          totalPages: whatsappTotalPages,
          totalTemplates: whatsappTotal
        }
      },
      emailTemplates: {
        // totalTemplate: emailTotal,
        favourite: emailFavourite,
        data: emailPaginated,
        emailTemplatePagination: {
          currentPage: Number(emailTemplatePage),
          totalPages: emailTotalPages,
          totalTemplates: emailTotal
        }
      }
    };

    delete data.whatsappTemplates;
    delete data.emailTemplates;

    return res.json({
      status: "success",
      message: "User fetched successfully.",
      data,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({
      status: "error",
      message: "Error fetching the User",
    });
  }
};

module.exports = { getUserData };
