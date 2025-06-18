// const User = require("../models/userModel");

// const getNextSerialNumber = async () => {
//   const lastUser = await User.findOne().sort({ serialNumber: -1 }).select("serialNumber");
//   return lastUser?.serialNumber ? lastUser.serialNumber + 1 : 1;
// };

// module.exports = { getNextSerialNumber };

const User = require("../models/userModel");

const getNextSerialNumber = async () => {
    const lastUser = await User.findOne()
        .sort({ serialNumber: -1 }) // string sort works for numbers if left-padded
        .select("serialNumber");

    let last = 0;
    if (lastUser && lastUser.serialNumber) {
        last = parseInt(lastUser.serialNumber, 10); // convert string to number
    }

    const next = last + 1;

    // Always return as string, pad to 2 digits only if < 10
    return next.toString().padStart(2, "0");
};

module.exports = { getNextSerialNumber };

