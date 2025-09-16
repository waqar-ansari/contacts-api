const User = require("../models/userModel");
const {
  getOrCreateStripeCustomer,
  getStripeCreditBalance,
} = require("../utils/stripeUtils");

const getMyReferrals = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const user = await User.findById(currentUserId).lean();

    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });
    }

    // Get Stripe credit balance
    let creditBalance = 0;
    try {
      const customer = await getOrCreateStripeCustomer(user);
      const stripeCreditBalance = await getStripeCreditBalance(customer.id);
      creditBalance = Math.abs(stripeCreditBalance) / 100; // Convert to dollars
    } catch (error) {
      console.error("Error getting Stripe credit balance:", error);
      creditBalance = 0;
    }

    const referralCount = user.myReferrals.length;
    const referralUrl = `https://app.contacts.management/register?ref=${user.referralCode}`;

    if (!user.myReferrals || user.myReferrals.length === 0) {
      return res.status(200).json({
        status: "success",
        message: "No referrals yet",
        data: {
          creditBalance,
          referralCount,
          referralUrl,
        },
      });
    }

    // const referralIds = user.myReferrals.map(entry => entry._id.toString());

    // const referredUsers = await User.find({ _id: { $in: referralIds } }).lean();

    // // Build a map for quick lookup
    // const referredMap = {};
    // referredUsers.forEach(ref => {
    //     referredMap[ref._id.toString()] = ref;
    // });

    // let needsUpdate = false;
    // const updatedReferrals = user.myReferrals.map(entry => {
    //     const refUser = referredMap[entry._id.toString()];
    //     if (!refUser) return entry; // Skip if user not found

    //     const updatedEntry = { ...entry };
    //     let changed = false;

    //     if (!entry.firstname && refUser.firstname) {
    //         updatedEntry.firstname = refUser.firstname;
    //         changed = true;
    //     }

    //     if (!entry.lastname && refUser.lastname) {
    //         updatedEntry.lastname = refUser.lastname;
    //         changed = true;
    //     }

    //     if ((!entry.email || entry.email === "") && refUser.email) {
    //         updatedEntry.email = refUser.email;
    //         changed = true;
    //     }

    //     // if ((!entry.phonenumbers || entry.phonenumbers.length === 0) && refUser.phonenumbers?.length) {
    //     //     updatedEntry.phonenumbers = refUser.phonenumbers;
    //     //     changed = true;
    //     // }

    //     if ((!entry.phonenumbers || entry.phonenumbers.length === 0) && refUser.phonenumbers?.length) {
    //         // Ensure phonenumbers follow new structure
    //         updatedEntry.phonenumbers = refUser.phonenumbers.map(p => ({
    //             countryCode: p.countryCode?.replace(/^\+/, "") || "",
    //             number: p.number?.replace(/^\+/, "") || ""
    //         }));
    //         changed = true;
    //     }

    //     if (!entry.signupDate && refUser.createdAt) {
    //         updatedEntry.signupDate = refUser.createdAt;
    //         changed = true;
    //     }

    //     if (changed) {
    //         needsUpdate = true;
    //     }

    //     return updatedEntry;
    // });

    // // Only update in DB if there's a change
    // if (needsUpdate) {
    //     await User.updateOne(
    //         { _id: currentUserId },
    //         { $set: { myReferrals: updatedReferrals } }
    //     );
    // }

    const referralIds = (user.myReferrals || [])
      .map((entry) => {
        // entry may be an object or an ObjectId/string; normalize to string id
        if (!entry) return null;
        if (typeof entry === "object" && entry._id) return entry._id.toString();
        return entry.toString();
      })
      .filter(Boolean);

    const referredUsers = await User.find({ _id: { $in: referralIds } }).lean();

    // Build a map for quick lookup
    const referredMap = {};
    referredUsers.forEach((ref) => {
      referredMap[ref._id.toString()] = ref;
    });

    let needsUpdate = false;
    const updatedReferrals = (user.myReferrals || []).map((entry) => {
      // normalize entryId and create a mutable object
      const entryId =
        typeof entry === "object" && entry._id
          ? entry._id.toString()
          : entry
          ? entry.toString()
          : null;
      // If entryId is missing, return entry as-is
      if (!entryId) return entry;

      const refUser = referredMap[entryId];

      // create a base object (if entry was just an id string, create object shell)
      const updatedEntry =
        typeof entry === "object"
          ? { ...entry }
          : {
              _id: entryId,
              firstname: "",
              lastname: "",
              email: "",
              phonenumbers: [],
              signupDate: null,
            };

      let changed = false;

      if (refUser) {
        console.log(refUser);

        if (!updatedEntry.firstname && refUser.firstname) {
          updatedEntry.firstname = refUser.firstname;
          changed = true;
        }
        if (!updatedEntry.lastname && refUser.lastname) {
          updatedEntry.lastname = refUser.lastname;
          changed = true;
        }
        if (!updatedEntry.signupMethod && refUser.signupMethod) {
          updatedEntry.signupMethod = refUser.signupMethod;
          changed = true;
        }
        if (
          (!updatedEntry.email || updatedEntry.email === "") &&
          refUser.email
        ) {
          updatedEntry.email = refUser.email;
          changed = true;
        }

        // Convert refUser.phonenumbers (top-level user format) -> myReferrals.phone object array
        if (
          (!Array.isArray(updatedEntry.phonenumbers) ||
            updatedEntry.phonenumbers.length === 0) &&
          Array.isArray(refUser.phonenumbers) &&
          refUser.phonenumbers.length
        ) {
          updatedEntry.phonenumbers = refUser.phonenumbers.map((p) => ({
            countryCode: (p.countryCode || "").toString().replace(/^\+/, ""),
            number: (p.number || "").toString().replace(/^\+/, ""),
          }));
          changed = true;
        }

        if (!updatedEntry.signupDate && refUser.createdAt) {
          updatedEntry.signupDate = refUser.createdAt;
          changed = true;
        }
      }

      if (changed) needsUpdate = true;
      return updatedEntry;
    });

    // Only update DB if something changed
    if (needsUpdate) {
      await User.updateOne(
        { _id: currentUserId },
        { $set: { myReferrals: updatedReferrals } }
      );
    }

    const referrals = updatedReferrals;
    return res.status(200).json({
      status: "success",
      message: "Referrals retrieved successfully",
      data: {
        referrals,
        creditBalance,
        referralCount,
        referralUrl,
      },
    });
  } catch (err) {
    console.error("Get referrals error:", err.message);
    return res.status(500).json({
      status: "error",
      message: "Failed to retrieve referrals",
      error: err.message,
    });
  }
};

module.exports = {
  getMyReferrals,
};
