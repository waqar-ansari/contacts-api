const User = require("../../models/userModel");

const getAllUsers = async (req, res) => {
    try {

        const users = await User.find({ role: "user" }).select("-password -salt -__v");
        // Count active & inactive users
        const activeCount = await User.countDocuments({ role: "user", isActive: true });
        const inactiveCount = await User.countDocuments({ role: "user", isActive: false });
        res.status(200).json({
            status: "success",
            message: "Users retrieved successfully",
            count: users.length,
            activeCount,
            inactiveCount,
            data: users
        });
    } catch (err) {
        console.error("Get Users Error:", err);
        res.status(500).json({ status: "error", message: "Server error" });
    }
};

module.exports = { getAllUsers };