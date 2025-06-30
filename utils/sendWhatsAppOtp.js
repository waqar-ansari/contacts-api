const axios = require('axios');
require('dotenv').config();

const sendWhatsAppOtp = async (toPhoneNumber, otp) => {
    try {
        const url = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

        const payload = {
            messaging_product: "whatsapp",
            to: toPhoneNumber,
            type: "template",
            template: {
                name: "otp",
                language: {
                    code: "en_US"
                },
                components: [
                    {
                        type: "body",
                        parameters: [
                            { type: "text", text: otp }
                        ]
                    },
                    {
                        type: "button",
                        sub_type: "url",
                        index: 0,
                        parameters: [
                            { type: "text", text: otp }  // Just the OTP (must be ≤ 15 characters)
                        ]
                    }
                ]
            }
        };

        const headers = {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json"
        };

        const response = await axios.post(url, payload, { headers });
        console.log("✅ WhatsApp OTP Sent:", response.data);

    } catch (error) {
        console.error("❌ WhatsApp API Error:", error.response?.data || error.message);
        throw error;
    }
};

module.exports = sendWhatsAppOtp;
