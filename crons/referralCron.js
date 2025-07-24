const cron = require("node-cron");
// const Referral = require("../models/referralModel");
const User = require("../models/userModel");

// cron.schedule("0 2 * * *", async () => {
// // cron.schedule("*/2 * * * *", async () => {
//     console.log("🔁 Running referral sync cron...");

//     const users = await User.find({});

//     for (const user of users) {
//         if (!user._id) continue;

//         const referral = await Referral.findOne({ referredUserId: user._id });

//         if (referral) {
//             let updated = false;

//             if (!referral.friendName && user.firstname && user.lastname) {
//                 referral.friendName = `${user.firstname} ${user.lastname}`;
//                 updated = true;
//             }

//             if (!referral.email && user.email) {
//                 referral.email = user.email;
//                 updated = true;
//             }

//             if (!referral.phonenumbers && user.phonenumbers?.length > 0) {
//                 referral.phonenumbers = user.phonenumbers[0];
//                 updated = true;
//             }

//             if (!referral.signupDate && user.createdAt) {
//                 referral.signupDate = user.createdAt;
//                 updated = true;
//             }

//             if (updated) {
//                 await referral.save();
//                 console.log(`✅ Referral updated for user ${user._id}`);
//             }
//         }
//     }

//     console.log("✅ Referral sync cron completed.");
// }, {
//     scheduled: true,
//     recoverMissedExecutions: true // optional in newer versions
// }
// );
