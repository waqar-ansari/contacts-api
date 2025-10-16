const User = require("../models/userModel");
const Contact = require("../models/contactModel");
// ---------- add these right after your requires ----------
function escapeRegex(str) {
    // simple regex-escape
    return (str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePhoneObj(p) {
    if (!p) return null;
    const cc = (p.countryCode || "").replace(/^\+/, "").replace(/\s+/g, "").trim();
    const num = (p.number || "").replace(/^\+/, "").replace(/\s+/g, "").trim();
    const combined = `${cc}${num}`;
    return { cc, num, combined };
}

/**
 * Find contact by email or phones for the given owner (createdBy).
 * Returns the contact doc (lean) or null.
 */
async function findContactByEmailOrPhone(ownerId, email, phones) {
    const orConditions = [];

    // email (case-insensitive)
    if (email) {
        orConditions.push({
            emailaddresses: { $elemMatch: { $regex: new RegExp("^" + escapeRegex(email) + "$", "i") } }
        });
    }

    // phones array of { countryCode, number } objects
    if (Array.isArray(phones)) {
        for (const p of phones) {
            const norm = normalizePhoneObj(p);
            if (!norm) continue;
            // match by countryCode+number pair (same array element)
            orConditions.push({ phonenumbers: { $elemMatch: { countryCode: norm.cc, number: norm.num } } });
            // match if number stored as combined string
            orConditions.push({ phonenumbers: { $elemMatch: { number: norm.combined } } });
            // match if number stored without country code
            orConditions.push({ phonenumbers: { $elemMatch: { number: norm.num } } });
        }
    }

    if (!orConditions.length) return null;

    const contact = await Contact.findOne({ createdBy: ownerId, $or: orConditions })
        .select("contact_id _id")
        .lean();

    return contact || null;
}
// ---------- end helper ----------


exports.getScanData = async (req, res) => {
    const userId = req.user._id;
    const { apiType = "mobile" } = req.body; // or req.query, depending on how you send

    try {
        const user = await User.findById(userId)
            .populate({
                path: "iScanned",
                select: "firstname lastname email profileImageURL phonenumbers linkedin instagram telegram twitter facebook createdAt",
            })
            .lean(); // make it easier to manipulate data

        if (!user) {
            return res.status(404).json({ status: "error", message: "User not found" });
        }
        console.log("user.iScanned:", user.iScanned);
        // STEP 1: Process iScanned
        const iScannedUsers = await Promise.all(
            (user.iScanned || []).map(async scannedUser => {
                // new: find by email or phone(s)
                const contact = await findContactByEmailOrPhone(userId, scannedUser.email, scannedUser.phonenumbers);
                console.log("Found contact:", contact);
                console.log("scannedUser.phonenumbers:", scannedUser.phonenumbers);

                return {
                    id: scannedUser._id || null,
                    firstname: scannedUser.firstname || '',
                    lastname: scannedUser.lastname || '',
                    email: scannedUser.email || '',
                    phonenumbers: Array.isArray(scannedUser.phonenumbers)
                        ? scannedUser.phonenumbers.map(p =>
                            apiType === "web"
                                ? `${(p.countryCode || "").replace(/^\+/, "")}${p.number || ""}`
                                : { countryCode: p.countryCode || "", number: p.number || "" }
                        )
                        : (scannedUser.phonenumber
                            ? [
                                apiType === "web"
                                    ? `${(scannedUser.countryCode || "").replace(/^\+/, "")}${scannedUser.phonenumber.replace(/^\+/, "")}`
                                    : {
                                        countryCode: (scannedUser.countryCode || "").replace(/^\+/, ""),
                                        number: scannedUser.phonenumber.replace(/^\+/, "")
                                    }
                            ]
                            : []),
                    profileImageURL: scannedUser.profileImageURL || '',
                    linkedin: scannedUser.linkedin || '',
                    instagram: scannedUser.instagram || '',
                    telegram: scannedUser.telegram || '',
                    twitter: scannedUser.twitter || '',
                    facebook: scannedUser.facebook || '',
                    createdAt: scannedUser.createdAt,
                    iScanned: true,
                    contact_id: contact ? (contact.contact_id || contact._id) : null,
                };
            })
        );

        // STEP 2: Process scannedMe
        const scannedMeEntries = user.scannedMe || [];
        const scannedMeUsers = [];

        for (const entry of scannedMeEntries) {
            if (typeof entry === "object" && entry._id && typeof entry._id === "object") {
                // This is an ObjectId ref to User — populate it manually
                const fullUser = await User.findById(entry._id)
                    .select("firstname lastname email profileImageURL phonenumbers  linkedin instagram telegram twitter facebook createdAt")
                    .lean();

                if (fullUser && !user.iScanned.some(u => u?._id?.toString() === fullUser._id.toString())) {
                    const contact = await findContactByEmailOrPhone(userId, fullUser.email, fullUser.phonenumbers);
                    console.log("Found contact:", contact);
                    scannedMeUsers.push({
                        id: fullUser._id,
                        firstname: fullUser.firstname || '',
                        lastname: fullUser.lastname || '',
                        email: fullUser.email || '',
                        phonenumbers: Array.isArray(fullUser.phonenumbers)
                            ? fullUser.phonenumbers.map(p =>
                                apiType === "web"
                                    ? `${(p.countryCode || "").replace(/^\+/, "")}${p.number || ""}`
                                    : { countryCode: p.countryCode || "", number: p.number || "" }
                            )
                            : [],
                        profileImageURL: fullUser.profileImageURL || '',
                        linkedin: fullUser.linkedin || '',
                        instagram: fullUser.instagram || '',
                        telegram: fullUser.telegram || '',
                        twitter: fullUser.twitter || '',
                        facebook: fullUser.facebook || '',
                        createdAt: fullUser.createdAt,
                        iScanned: false,
                        contact_id: contact ? (contact.contact_id || contact._id) : null,
                    });
                }
            }
            else if (typeof entry === "object") {
                // Temporary scanned user (not yet registered)
                const contact = await findContactByEmailOrPhone(userId, entry.email, entry.phonenumbers);
                scannedMeUsers.push({
                    id: null,
                    contact_id: contact ? (contact.contact_id || contact._id) : null,
                    firstname: entry.firstname || '',
                    lastname: entry.lastname || '',
                    email: entry.email || '',
                    phonenumbers: Array.isArray(entry.phonenumbers)
                        ? entry.phonenumbers.map(p =>
                            apiType === "web"
                                ? `${(p.countryCode || "").replace(/^\+/, "")}${p.number || ""}`
                                : { countryCode: p.countryCode || "", number: p.number || "" }
                        )
                        : (entry.phonenumber
                            ? [
                                apiType === "web"
                                    ? `${(entry.countryCode || "").replace(/^\+/, "")}${entry.phonenumber.replace(/^\+/, "")}`
                                    : {
                                        countryCode: entry.countryCode?.replace(/^\+/, "") || "",
                                        number: entry.phonenumber.replace(/^\+/, "")
                                    }
                            ]
                            : []),
                    linkedin: entry.linkedin || '',
                    instagram: entry.instagram || '',
                    telegram: entry.telegram || '',
                    twitter: entry.twitter || '',
                    facebook: entry.facebook || '',
                    createdAt: new Date(), // Use current date for temp entries
                    profileImageURL: '',
                    iScanned: false,
                });
            }
        }

        const combined = [...iScannedUsers, ...scannedMeUsers];

        return res.status(200).json({
            status: "success",
            message: "Scan Data Fetched",
            data: combined,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: "error", message: "Failed to fetch scan data" });
    }
};