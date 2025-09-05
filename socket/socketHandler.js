const User = require("../models/userModel");
console.log("[socketHandler] module loaded");

const onlineUsers = new Map(); // socket.id -> userId
console.log("[socketHandler] onlineUsers map initialized");

// helper to emit counts (only users with role: "user")
const emitUserCounts = async (io) => {
  try {
    const activeCount = await User.countDocuments({ role: "user", isActive: true });
    const inactiveCount = await User.countDocuments({ role: "user", isActive: false });
    const total = activeCount + inactiveCount;

    const counts = { activeCount, inactiveCount, total };
    console.log("[socketHandler] broadcasting user counts:", counts);

    io.emit("user_counts", counts);
  } catch (err) {
    console.error("[socketHandler] error while counting users:", err);
  }
};

module.exports = (io) => {
  console.log("[socketHandler] attaching to io");

  io.on("connection", (socket) => {
    console.log(`[socketHandler] New socket connected: ${socket.id}`);

    // user online
    socket.on("user_online", async (userId) => {
      console.log("[socketHandler] user_online event received:", userId);
      try {
        onlineUsers.set(socket.id, userId);

        if (userId && userId.toString().length === 24) {
          const user = await User.findOneAndUpdate(
            { _id: userId, role: "user" }, // ✅ only update if role=user
            { isActive: true },
            { new: true }
          );

          if (user) {
            console.log(`[socketHandler] DB: isActive=true for ${userId}`);
            io.emit("update_user_status", { userId, isActive: true });
          } else {
            console.log(`[socketHandler] skipped: user ${userId} not found or not role=user`);
          }
        }

        // ✅ also broadcast counts
        await emitUserCounts(io);
      } catch (err) {
        console.error("[socketHandler] error in user_online:", err);
      }
    });

    // user logout
    socket.on("user_logout", async (userId) => {
      console.log("[socketHandler] user_logout event received:", userId);
      try {
        if (userId && userId.toString().length === 24) {
          const user = await User.findOneAndUpdate(
            { _id: userId, role: "user" }, // ✅ only update if role=user
            { isActive: false, lastSeen: new Date() },
            { new: true }
          );

          if (user) {
            console.log(`[socketHandler] DB: isActive=false for ${userId}`);
            io.emit("update_user_status", { userId, isActive: false });
          } else {
            console.log(`[socketHandler] skipped: user ${userId} not found or not role=user`);
          }
        }

        // ✅ also broadcast counts
        await emitUserCounts(io);
      } catch (err) {
        console.error("[socketHandler] error in user_logout:", err);
      }
    });

    // disconnect
    socket.on("disconnect", async (reason) => {
      console.log(`[socketHandler] disconnect: ${socket.id} reason: ${reason}`);
      const userId = onlineUsers.get(socket.id);

      if (userId) {
        onlineUsers.delete(socket.id);
        try {
          if (userId && userId.toString().length === 24) {
            const user = await User.findOneAndUpdate(
              { _id: userId, role: "user" }, // ✅ only update if role=user
              { isActive: false, lastSeen: new Date() },
              { new: true }
            );

            if (user) {
              console.log(`[socketHandler] DB: isActive=false for ${userId} on disconnect`);
              io.emit("update_user_status", { userId, isActive: false });
            } else {
              console.log(`[socketHandler] skipped: user ${userId} not found or not role=user`);
            }
          }

          // ✅ also broadcast counts
          await emitUserCounts(io);
        } catch (err) {
          console.error("[socketHandler] error on disconnect:", err);
        }
      }
    });

    // ✅ send counts immediately when a new socket connects
    emitUserCounts(io);
  });
};
