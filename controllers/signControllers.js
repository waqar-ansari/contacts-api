const fs = require("fs");
const { execFile } = require("child_process");
const { CERTIFICATE_PATH, PRIVATE_KEY_PATH, WWDR_PATH } = require("../config/certificates");

const applePaymentSign = async(req,res)=>{

    try {
        if (!req.file) {
                return res.status(400).json({ error: "No manifest file uploaded." });
            }
        
            const manifestPath = req.file.path;
            const signaturePath = `${manifestPath}_signature`;
        
            // OpenSSL command to sign manifest.json
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
                    console.error("❌ Error signing pass:", error);
                    return res.status(500).json({ error: `Error signing pass: ${error.message}` });
                }
        
                // Verify the signature file
                fs.readFile(signaturePath, (readErr, signature) => {
                    if (readErr) {
                        console.error("❌ Error reading signature:", readErr);
                        return res.status(500).json({ error: "Failed to read signature." });
                    }
        
                    res.set({
                        "Content-Type": "application/octet-stream",
                        "Content-Disposition": "attachment; filename=\"signature\""
                    });
        
                    res.send(signature);
        
                    // Cleanup temporary files after response
                    fs.unlinkSync(manifestPath);
                    fs.unlinkSync(signaturePath);
                });
            });
    } catch(error) {
        console.error(error);
        return res.status(500).send({
          status: "error",
          message: "Server error, try again later",
        });
    }
}

module.exports={applePaymentSign}