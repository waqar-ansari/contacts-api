const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { CERTIFICATE_PATH, PRIVATE_KEY_PATH, WWDR_PATH } = require("../config/certificates");

const applePaymentSign = async (req, res) => {
    try {
        const manifest = req.body.manifest;

        if (!manifest || typeof manifest !== "object") {
            return res.status(400).json({ error: "Manifest data is missing or invalid." });
        }

        // Create a temporary file for manifest.json
        const manifestContent = JSON.stringify(manifest);
        const tempDir = os.tmpdir();
        const manifestPath = path.join(tempDir, `manifest_${Date.now()}.json`);
        const signaturePath = `${manifestPath}_signature`;

        fs.writeFileSync(manifestPath, manifestContent);

        // OpenSSL command to sign the manifest
        const args = [
            "smime",
            "-binary",
            "-sign",
            "-certfile", WWDR_PATH,
            "-signer", CERTIFICATE_PATH,
            "-inkey", PRIVATE_KEY_PATH,
            "-in", manifestPath,
            "-out", signaturePath,
            "-outform", "DER"
        ];

        execFile("openssl", args, (error) => {
            if (error) {
                console.error("❌ Error signing manifest:", error);
                fs.unlinkSync(manifestPath);
                return res.status(500).json({ error: `Error signing manifest: ${error.message}` });
            }

            fs.readFile(signaturePath, (readErr, signature) => {
                if (readErr) {
                    console.error("❌ Error reading signature:", readErr);
                    fs.unlinkSync(manifestPath);
                    return res.status(500).json({ error: "Failed to read signature." });
                }

                // Send the signature as a binary response
                res.set({
                    "Content-Type": "application/octet-stream",
                    "Content-Disposition": "attachment; filename=\"signature\""
                });

                res.send(signature);

                // Cleanup
                fs.unlinkSync(manifestPath);
                fs.unlinkSync(signaturePath);
            });
        });

    } catch (error) {
        console.error("❌ Server error:", error);
        return res.status(500).json({
            status: "error",
            message: "Server error, try again later",
        });
    }
};

module.exports = { applePaymentSign };