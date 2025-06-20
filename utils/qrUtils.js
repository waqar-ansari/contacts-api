const QRCode = require("qrcode");

async function generateUserQRCode(name, serialNumber, extraData = {}) {
  const qrContent = JSON.stringify({
    name,
    serialNumber,
    ...extraData
  });

  const qrCodeDataURL = await QRCode.toDataURL(qrContent); // returns base64 PNG
  return { qrCode: qrCodeDataURL };
}

module.exports = { generateUserQRCode };
