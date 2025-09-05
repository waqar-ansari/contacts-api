// socket/socketHandler.js
const User = require("../models/userModel"); // adjust path if needed
console.log("[socketHandler] module loaded");

const onlineUsers = new Map(); // socket.id -> userId
console.log("[socketHandler] onlineUsers map initialized");

module.exports = (io) => {
    console.log("[socketHandler] attaching to io");
    //   console.log("[socketHandler] io.engine:", io.engine); // should show Engine instance


    io.on("connection", (socket) => {
        console.log(`${socket.id}`);
        console.log(`[socketHandler] New socket connected: ${socket.id}`);
        console.log("[socketHandler] handshake.query:", socket.handshake.query);
        // show minimal header info:
        console.log("[socketHandler] handshake.origin:", socket.handshake.headers?.origin);

        socket.on("user_online", async (userId) => {
            console.log("[socketHandler] user_online event received:", userId);
            try {
                onlineUsers.set(socket.id, userId);
                // basic validation to avoid DB errors
                if (userId && userId.toString().length === 24) {
                    await User.findByIdAndUpdate(userId, { isActive: true });
                    console.log(`[socketHandler] DB: isActive=true for ${userId}`);
                } else {
                    console.log("[socketHandler] skipping DB update - invalid userId:", userId);
                }
                io.emit("update_user_status", { userId, isActive: true });
            } catch (err) {
                console.error("[socketHandler] error in user_online:", err);
            }
        });

        socket.on("user_logout", async (userId) => {
            console.log("[socketHandler] user_logout event received:", userId);
            try {
                if (userId && userId.toString().length === 24) {
                    await User.findByIdAndUpdate(userId, { isActive: false, lastSeen: new Date() });
                    console.log(`[socketHandler] DB: isActive=false for ${userId}`);
                } else {
                    console.log("[socketHandler] skipping DB update - invalid userId:", userId);
                }
                io.emit("update_user_status", { userId, isActive: false });
            } catch (err) {
                console.error("[socketHandler] error in user_logout:", err);
            }
        });

        socket.on("disconnect", async (reason) => {
            console.log(`[socketHandler] disconnect: ${socket.id} reason: ${reason}`);
            const userId = onlineUsers.get(socket.id);
            if (!userId) {
                console.log("[socketHandler] no user mapped to this socket");
                return;
            }
            onlineUsers.delete(socket.id);
            try {
                if (userId && userId.toString().length === 24) {
                    await User.findByIdAndUpdate(userId, { isActive: false, lastSeen: new Date() });
                    console.log(`[socketHandler] DB: isActive=false for ${userId} on disconnect`);
                } else {
                    console.log("[socketHandler] invalid userId on disconnect:", userId);
                }
                io.emit("update_user_status", { userId, isActive: false });
            } catch (err) {
                console.error("[socketHandler] error on disconnect:", err);
            }
        });
    });
};
