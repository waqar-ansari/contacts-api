// socket/socketHandler.js
const User = require("../models/userModel");

// In-memory storage for active users (only user IDs)
let activeUserIds = new Set();

const socketHandler = (io) => {
  console.log("🔌 Socket.IO server initialized");

  io.on("connection", async (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    try {
      const { userId } = socket.handshake.query;

      if (!userId) {
        console.log("No userId provided in socket connection");
        return;
      }

      // Fetch user from database
      const user = await User.findById(userId);
      if (!user) {
        console.log(`User not found: ${userId}`);
        socket.disconnect(true);
        return;
      }

      console.log(
        `User connected: ${user.firstname} ${user.lastname} (${user.role})`
      );

      if (user.role === "user") {
        // Add user to active users set
        const wasEmpty = activeUserIds.size === 0;
        activeUserIds.add(userId);

        // Store userId in socket for cleanup
        socket.userId = userId;

        console.log(`Active users count: ${activeUserIds.size}`);

        // Emit updated count to all connected admins
        await emitUserCountChanged(io);
      } else if (user.role === "superadmin") {
        // Admin connected - send current count immediately
        const totalUsersCount = await User.countDocuments();

        socket.emit("user_count_changed", {
          count: activeUserIds.size,
          totalUsers: totalUsersCount,
          timestamp: new Date(),
        });

        console.log(
          `Admin connected, sent current count: ${activeUserIds.size}, total users: ${totalUsersCount}`
        );
      }

      // Handle socket disconnection
      socket.on("disconnect", async () => {
        console.log(`Socket disconnected: ${socket.id}`);

        if (socket.userId) {
          try {
            // Fetch user again to verify role (in case of role changes)
            // const user = await User.findById(socket.userId);

            if (
              // user &&
              // user.role === "user" &&
              activeUserIds.has(socket.userId)
            ) {
              activeUserIds.delete(socket.userId);
              console.log(
                `User ${socket.userId} removed from active users. Count: ${activeUserIds.size}`
              );

              // Emit updated count to all connected admins
              await emitUserCountChanged(io);
            }
          } catch (error) {
            console.error(
              `Error handling disconnect for user ${socket.userId}:`,
              error
            );
            // Still try to remove from active users
            if (activeUserIds.has(socket.userId)) {
              activeUserIds.delete(socket.userId);
              await emitUserCountChanged(io);
            }
          }
        }
      });
    } catch (error) {
      console.error("Error in socket connection handler:", error);
      socket.disconnect(true);
    }
  });

  // Cleanup inactive users every 10 minutes
  // This is a safety net in case some disconnections weren't handled properly
  setInterval(async () => {
    await cleanupInactiveUsers(io);
  }, 10 * 60 * 1000); // 10 minutes
};

// Helper function to emit user count changes to all admins
async function emitUserCountChanged(io) {
  try {
    const totalUsersCount = await User.countDocuments();

    const data = {
      count: activeUserIds.size,
      totalUsers: totalUsersCount,
      timestamp: new Date(),
    };

    io.emit("user_count_changed", data);
    console.log(
      `📊 Emitted user_count_changed: active=${data.count}, total=${data.totalUsers}`
    );
  } catch (error) {
    console.error("Error fetching total users count:", error);
    // Fallback to sending just active count
    const data = {
      count: activeUserIds.size,
      timestamp: new Date(),
    };
    io.emit("user_count_changed", data);
    console.log(`📊 Emitted user_count_changed (fallback): ${data.count}`);
  }
}

// Safety cleanup function - verify users still exist in database
async function cleanupInactiveUsers(io) {
  try {
    const userIdsArray = Array.from(activeUserIds);
    if (userIdsArray.length === 0) return;

    // Check which users still exist and have role "user"
    const existingUsers = await User.find({
      _id: { $in: userIdsArray },
      role: "user",
    }).select("_id");

    const existingUserIds = new Set(
      existingUsers.map((user) => user._id.toString())
    );
    const initialCount = activeUserIds.size;

    // Remove users that no longer exist or don't have "user" role
    activeUserIds.forEach((userId) => {
      if (!existingUserIds.has(userId)) {
        activeUserIds.delete(userId);
      }
    });

    const removedCount = initialCount - activeUserIds.size;

    if (removedCount > 0) {
      console.log(
        `🧹 Cleanup: Removed ${removedCount} inactive/invalid users. Active count: ${activeUserIds.size}`
      );
      await emitUserCountChanged(io);
    }
  } catch (error) {
    console.error("Error in cleanup inactive users:", error);
  }
}

// Export function to get current active users count
function getActiveUsersCount() {
  return activeUserIds.size;
}

// Export function to get active user IDs (for debugging/monitoring)
function getActiveUserIds() {
  return Array.from(activeUserIds);
}

module.exports = socketHandler;
module.exports.getActiveUsersCount = getActiveUsersCount;
module.exports.getActiveUserIds = getActiveUserIds;
