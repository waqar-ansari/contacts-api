const Contact = require("../models/contactModel");
const User = require("../models/userModel");
const { route } = require("../routes/userRoutes");
const QRCode = require("qrcode");
// const { generateUserQRCode } = require("../utils/qrUtils");



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

      // Before return res.json(...)

      const qrPayload = {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        phonenumbers: user.phonenumbers,
        serialNumber: user.serialNumber,
        email: user.email,
        profileImageURL: user.profileImageURL,
        instagram: user.instagram,
        linkedin: user.linkedin,
        telegram: user.telegram,
        twitter: user.twitter,
        facebook: user.facebook,
        designation: user.designation,
        signupMethod: user.signupMethod,
        role: user.role,
        referredBy: user.referredBy || null,
        referralCode: user.referralCode || null,
        referralUrl: `https://app.contacts.management/register?ref=${user.referralCode}`,
      };

      // Generate QR code (as Base64 image)
      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrPayload));


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
          // qrCode: user.qrCode,
          qrCode: qrCodeDataURL,
          instagram: user.instagram,
          linkedin: user.linkedin,
          telegram: user.telegram,
          twitter: user.twitter,
          facebook: user.facebook,
          designation: user.designation,
          serialNumber: user.serialNumber,
          signupMethod: user.signupMethod,
          role: user.role, // Ensure role is set
          referredBy: user.referredBy || null,
          myReferrals: user.myReferrals || [],
          referralCode: user.referralCode || null,
          referralUrl: `https://app.contacts.management/register?ref=${user.referralCode}`,
          creditBalance: user.creditBalance || 0,
          accounts: [
            {
              type: "google",
              id: user.googleId,
              email: user.googleEmail,
              googleAccessToken: user.googleAccessToken,
              googleRefreshToken: user.googleRefreshToken,
              isConnected: user.googleConnected,
            },
            {
              type: "microsoft",
              id: user.microsoftId,
              email: user.microsoftEmail,
              microsoftAccessToken: user.microsoftAccessToken,
              microsoftRefreshToken: user.microsoftRefreshToken,
              isConnected: user.microsoftConnected,
            },
            {
              type: "smtp",
              id: user.smtpId,
              smtpHost: user.smtpHost,
              smtpPort: user.smtpPort,
              email: user.smtpUser,
              smtpPass: user.smtpPass,
              smtpSecure: user.smtpSecure,
              isConnected: user.smtpConnected,
            },
          ],
          shareProfileCount: user.shareProfileCount || 0,
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

      const qrPayload = {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        phonenumbers: user.phonenumbers,
        serialNumber: user.serialNumber,
        email: user.email,
        profileImageURL: user.profileImageURL,
        instagram: user.instagram,
        linkedin: user.linkedin,
        telegram: user.telegram,
        twitter: user.twitter,
        facebook: user.facebook,
        designation: user.designation,
        signupMethod: user.signupMethod,
        role: user.role,
        referredBy: user.referredBy || null,
        referralCode: user.referralCode || null,
        referralUrl: `https://app.contacts.management/register?ref=${user.referralCode}`,
      };

      // Generate QR code (as Base64 image)
      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrPayload));


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
          // qrCode: user.qrCode,
          instagram: user.instagram,
          linkedin: user.linkedin,
          telegram: user.telegram,
          twitter: user.twitter,
          facebook: user.facebook,
          designation: user.designation,
          signupMethod: user.signupMethod,
          role: user.role,
          referredBy: user.referredBy || null,
          myReferrals: user.myReferrals || [],
          referralCode: user.referralCode || null,
          referralUrl: `https://app.contacts.management/register?ref=${user.referralCode}`,
          creditBalance: user.creditBalance || 0,
          qrCode: qrCodeDataURL,
          accounts: [
            {
              type: "google",
              id: user.googleId,
              email: user.googleEmail,
              googleAccessToken: user.googleAccessToken,
              googleRefreshToken: user.googleRefreshToken,
              isConnected: user.googleConnected,
            },
            {
              type: "microsoft",
              id: user.microsoftId,
              email: user.microsoftEmail,
              microsoftAccessToken: user.microsoftAccessToken,
              microsoftRefreshToken: user.microsoftRefreshToken,
              isConnected: user.microsoftConnected,
            },
            {
              type: "smtp",
              id: user.smtpId,
              smtpHost: user.smtpHost,
              smtpPort: user.smtpPort,
              email: user.smtpUser,
              smtpPass: user.smtpPass,
              smtpSecure: user.smtpSecure,
              isConnected: user.smtpConnected,
            },
          ],
          shareProfileCount: user.shareProfileCount || 0,
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
      // qrCode: user.qrCode,
      instagram: user.instagram,
      linkedin: user.linkedin,
      telegram: user.telegram,
      twitter: user.twitter,
      facebook: user.facebook,
      designation: user.designation,
      signupMethod: user.signupMethod,
      role: user.role,
      referredBy: user.referredBy || null,
      myReferrals: user.myReferrals || [],
      referralCode: user.referralCode || null,
      referralUrl: `https://app.contacts.management/register?ref=${user.referralCode}`,
      creditBalance: user.creditBalance || 0,
      accounts: [
        {
          type: "google",
          id: user.googleId,
          email: user.googleEmail,
          googleAccessToken: user.googleAccessToken,
          googleRefreshToken: user.googleRefreshToken,
          isConnected: user.googleConnected,
        },
        {
          type: "microsoft",
          id: user.microsoftId,
          email: user.microsoftEmail,
          microsoftAccessToken: user.microsoftAccessToken,
          microsoftRefreshToken: user.microsoftRefreshToken,
          isConnected: user.microsoftConnected,
        },
        {
          type: "smtp",
          id: user.smtpId,
          smtpHost: user.smtpHost,
          smtpPort: user.smtpPort,
          email: user.smtpUser,
          smtpPass: user.smtpPass,
          smtpSecure: user.smtpSecure,
          isConnected: user.smtpConnected,
        },
      ],
      shareProfileCount: user.shareProfileCount || 0,
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


    const qrPayload = {
      id: user._id,
      firstname: user.firstname,
      lastname: user.lastname,
      phonenumbers: user.phonenumbers,
      serialNumber: user.serialNumber,
      email: user.email,
      profileImageURL: user.profileImageURL,
      instagram: user.instagram,
      linkedin: user.linkedin,
      telegram: user.telegram,
      twitter: user.twitter,
      facebook: user.facebook,
      designation: user.designation,
      signupMethod: user.signupMethod,
      role: user.role,
      referredBy: user.referredBy || null,
      referralCode: user.referralCode || null,
      referralUrl: `https://app.contacts.management/register?ref=${user.referralCode}`,
    };

    // Generate QR code (as Base64 image)
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrPayload));

    data.qrCode = qrCodeDataURL;

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