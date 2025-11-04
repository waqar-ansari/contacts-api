const User = require("../../models/userModel");
const AdminEmail = require("../../models/adminEmailModel");
const { sendMail } = require("../../utils/emailUtils");

const COUNTRY_TO_CODE = {
    in: "91",
    india: "91",
    pk: "92",
    pakistan: "92",
    bd: "880",
    bangladesh: "880",
    uae: "971",
    "united arab emirates": "971",
    us: "1",
    usa: "1",
    uk: "44",
    gb: "44",
    australia: "61",
    "australia": "61",
    canada: "1",
    cn: "86",
    china: "86",
    sg: "65",
    singapore: "65",
    nz: "64",
    "new zealand": "64",
    germany: "49",
    france: "33",
    japan: "81",
    brazil: "55",
    "south africa": "27",
    "south africa": "27",
    russia: "7",
    mexico: "52"
    // … continue for others …
};


// Normalize country input
function normalizeCountryCode(countryInput) {
    if (!countryInput) return null;
    const raw = String(countryInput).trim().toLowerCase();
    const digits = raw.replace(/^\+/, "").match(/^\d+$/);
    if (digits) return digits[0];
    if (COUNTRY_TO_CODE[raw]) return COUNTRY_TO_CODE[raw];
    const maybe = raw.replace(/\s+/g, "");
    if (COUNTRY_TO_CODE[maybe]) return COUNTRY_TO_CODE[maybe];
    return null;
}

// Escape regex
function escapeRegExp(string) {
    return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build query using AND logic for all provided filters.
 * If no filters provided, send to all subscribed users.
 */
function buildFilterQuery({ helps, goals, categories, employeeCount, gender, country }) {
    const andClauses = [];

    // Helps → user must have all helps values that are in the request
    if (helps && helps.length > 0) {
        andClauses.push({ "userInfo.helps": { $all: helps } });
    }

    // Goals → exact or partial match (case-insensitive)
    if (goals) {
        andClauses.push({ "userInfo.goals": { $regex: new RegExp(escapeRegExp(goals), "i") } });
    }

    // Categories
    if (categories) {
        andClauses.push({ "userInfo.categories": { $regex: new RegExp(escapeRegExp(categories), "i") } });
    }

    // Employee Count
    if (employeeCount) {
        andClauses.push({ "userInfo.employeeCount": { $regex: new RegExp(escapeRegExp(employeeCount), "i") } });
    }

    // Gender
    if (gender) {
        andClauses.push({ gender: { $regex: new RegExp("^" + escapeRegExp(gender) + "$", "i") } });
    }

    // Country
    if (country) {
        const code = normalizeCountryCode(country);
        if (code) {
            andClauses.push({
                phonenumbers: {
                    $elemMatch: { countryCode: { $regex: new RegExp("^" + escapeRegExp(code) + "$", "i") } },
                },
            });
        }
    }

    // Base conditions: must be subscribed and have email
    const baseAnd = [
        { userSubscribed: true },
        { email: { $exists: true, $ne: "" } },
    ];

    // If no filters at all → send to all subscribed users
    if (andClauses.length === 0) {
        return { $and: baseAnd };
    }

    // Combine base + all filter conditions (AND logic)
    return { $and: [...baseAnd, ...andClauses] };
}

/** Chunk helper */
function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
}

// 🚀 MAIN CONTROLLER
exports.sendEmailToFilteredUsers = async (req, res) => {
    try {
        const {
            subject,
            body,
            helps = [],
            goals = "",
            categories = "",
            employeeCount = "",
            gender = "",
            country = "",
            chunkSize = 100,
            from = '"Contacts Management" <noreply@contacts.management>',
        } = req.body;

        if (!subject || !body) {
            return res.status(400).json({ ok: false, message: "Subject and body are required" });
        }

        // Build query with AND logic
        const query = buildFilterQuery({
            helps,
            goals,
            categories,
            employeeCount,
            gender,
            country,
        });

        // Find matching users
        const users = await User.find(query, { email: 1, firstname: 1, lastname: 1 }).lean();

        if (!users || users.length === 0) {
            return res.status(200).json({ ok: true, message: "No matching users found", sent: 0 });
        }

        // Deduplicate emails
        const emailMap = new Map();
        users.forEach(u => {
            if (u.email) {
                const lower = u.email.trim().toLowerCase();
                if (!emailMap.has(lower)) {
                    emailMap.set(lower, { email: lower, name: `${u.firstname || ""} ${u.lastname || ""}`.trim() });
                }
            }
        });

        const recipients = Array.from(emailMap.values());
        if (recipients.length === 0) {
            return res.status(200).json({ ok: true, message: "No valid email addresses", sent: 0 });
        }

        // Send in chunks
        const chunks = chunkArray(recipients, Number(chunkSize));
        let totalSent = 0;
        const errors = [];

        for (const chunk of chunks) {
            const sendPromises = chunk.map(rec => {
                const mailOptions = {
                    from,
                    to: rec.email,
                    subject,
                    html: body,
                };
                return sendMail(mailOptions)
                    .then(() => ({ ok: true, email: rec.email }))
                    .catch(err => ({ ok: false, email: rec.email, error: err.message || err }));
            });

            const results = await Promise.allSettled(sendPromises);

            results.forEach(r => {
                if (r.status === "fulfilled") {
                    if (r.value.ok) totalSent++;
                    else errors.push(r.value);
                } else {
                    errors.push({ email: "unknown", error: r.reason });
                }
            });
        }

        // 🧾 Save record in DB
        await AdminEmail.create({
            subject,
            body,
            filters: { helps, goals, categories, employeeCount, gender, country },
            sentCount: totalSent,
            errorList: errors,
            createdBy: req.user?._id || null,
        });

        return res.status(200).json({
            status: "success",
            message: `Email Sent to Users, Total Email Received User : ${totalSent}`,
        });
    } catch (err) {
        console.error("Admin email send error:", err);
        return res.status(500).json({ status: "error", message: "Server error", error: err.message });
    }
};
//Email Sent to Users, Total Email Received User:${emails.length}

// 📥 GET all sent admin emails
exports.getAllSentEmails = async (req, res) => {
    try {
        const emails = await AdminEmail.find().sort({ createdAt: -1 });
        return res.status(200).json({
            status: "success",
            message: `Emails Fetched`,
            data: emails
        });
    } catch (err) {
        console.error("Fetch admin emails error:", err);
        return res.status(500).json({ status: error, message: "Server error", error: err.message });
    }
};
