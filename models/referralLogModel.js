// const mongoose = require("mongoose");


// const referralLogSchema = new mongoose.Schema({
//     email: { type: String, required: false },
//     // phonenumber: { type: String, required: false, unique: true },
//     phonenumbers: [
//         {
//             countryCode: {
//                 type: String,
//             },
//             number: {
//                 type: String,
//             },
//             _id: false,
//         },
//     ],
//     referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//     referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional, can be null if deleted
//     signupDate: { type: Date, default: Date.now },
// });


// module.exports = mongoose.model("ReferralLog", referralLogSchema);

const mongoose = require("mongoose");

const referralLogSchema = new mongoose.Schema({
    email: { type: String, required: false },
    phonenumbers: [
        {
            countryCode: { type: String, required: true },
            number: { type: String, required: true },
            _id: false,
        },
    ],
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional
    signupDate: { type: Date, default: Date.now },
});

// Optional: create an index to prevent duplicate phone numbers in logs
referralLogSchema.index(
    { "phonenumbers.countryCode": 1, "phonenumbers.number": 1 },
    { unique: true, sparse: true }
);

module.exports = mongoose.model("ReferralLog", referralLogSchema);



