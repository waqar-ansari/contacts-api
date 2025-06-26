const User = require('../models/userModel'); // Your User Model

exports.disconnectGoogle = async (req, res) => {
    const userId = req.user._id;

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        // Clear Google account details
        user.googleId = undefined;
        user.googleEmail = undefined;
        user.googleAccessToken = undefined;
        user.googleRefreshToken = undefined;
        user.googleConnected = false;

        await user.save();

        res.json({ status: 'success', message: 'Google account disconnected successfully' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to disconnect Google account', error: error.message });
    }
};
